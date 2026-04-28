import { createWriteStream } from "node:fs";
import {
	mkdir,
	readdir,
	readFile,
	rename,
	rm,
	rmdir,
	stat,
	writeFile,
} from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream } from "node:stream/web";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TaskFlowApiError, type TaskFlowClient } from "../client.js";

const CONCURRENCY = 8;
const STATE_FILE = ".taskflow-sync.json";
const MANIFEST_FILE = "manifest.json";
const TASK_MD_FILE = "task.md";
const TASK_JSON_FILE = "task.json";
const SUBMISSIONS_DIR = "submissions";
const MAX_NAME_LENGTH = 120;
const RESERVED_NAMES = new Set([
	"CON",
	"PRN",
	"AUX",
	"NUL",
	"COM1",
	"COM2",
	"COM3",
	"COM4",
	"COM5",
	"COM6",
	"COM7",
	"COM8",
	"COM9",
	"LPT1",
	"LPT2",
	"LPT3",
	"LPT4",
	"LPT5",
	"LPT6",
	"LPT7",
	"LPT8",
	"LPT9",
]);

interface AttachmentMeta {
	id: string;
	fileKey: string;
	originalName: string;
	renamedFile: string | null;
	mimeType: string | null;
	sizeBytes: number | null;
	isVisible: boolean;
	createdAt: string;
}

interface TaskDetail {
	id: string;
	classId: string | null;
	className: string | null;
	title: string;
	description: string | null;
	updatedAt: string;
	attachments: AttachmentMeta[];
	[key: string]: unknown;
}

interface SubmissionSummary {
	id: string;
	taskId: string;
	userId: string;
	firstSubmittedAt: string;
	lastUpdatedAt: string;
	content: string | null;
	score: string | null;
	reviewerId: string | null;
	reviewedAt: string | null;
	reviewNote: string | null;
	isExemplary: boolean;
}

interface SubmissionListRow {
	userId: string;
	nickname: string | null;
	email?: string | null;
	schoolName: string | null;
	studentId: string | null;
	role: string;
	submitted: boolean;
	submission: SubmissionSummary | null;
	attachments: unknown[];
}

interface SubmissionDetail extends SubmissionSummary {
	attachments: AttachmentMeta[];
}

interface PresignResponse {
	url: string;
	expiresIn: number;
}

interface ManagedFile {
	signature: string;
	kind:
		| "task-content"
		| "task-json"
		| "manifest"
		| "submission-content"
		| "submission-json"
		| "attachment";
	sourceId?: string;
	fileKey?: string;
}

interface SyncState {
	version: 1;
	taskId: string;
	taskDirName: string;
	managedFiles: Record<string, ManagedFile>;
	submissions: Record<string, { dir: string; lastUpdatedAt: string }>;
	lastSyncedAt: string;
}

interface DownloadedFile {
	path: string;
	source: "task" | "submission";
	fileKey?: string;
	bytes?: number | null;
}

interface FailedFile {
	path?: string;
	source: "task" | "submission";
	fileKey?: string;
	error: string;
}

interface SyncResult {
	taskId: string;
	taskDir: string;
	manifestPath: string;
	syncedSubmissions: number;
	downloadedFiles: DownloadedFile[];
	deletedFiles: string[];
	skippedFiles: string[];
	failedFiles: FailedFile[];
	failedSubmissions: Array<{ submissionId: string; error: string }>;
}

function formatError(err: unknown): string {
	if (err instanceof TaskFlowApiError)
		return `Error: ${err.code} — ${err.message}`;
	return `Error: ${err instanceof Error ? err.message : String(err)}`;
}

function errorResult(err: unknown) {
	return {
		content: [{ type: "text" as const, text: formatError(err) }],
		isError: true,
	};
}

function resultWithStructured(data: SyncResult) {
	const failedCount = data.failedFiles.length + data.failedSubmissions.length;
	const text = [
		`Task synced to ${data.taskDir}`,
		`Submissions synced: ${data.syncedSubmissions}`,
		`Files downloaded/updated: ${data.downloadedFiles.length}`,
		`Files skipped: ${data.skippedFiles.length}`,
		`Files deleted: ${data.deletedFiles.length}`,
		`Failures: ${failedCount}`,
	].join("\n");

	return {
		content: [{ type: "text" as const, text }],
		structuredContent: data as unknown as Record<string, unknown>,
	};
}

async function exists(filePath: string): Promise<boolean> {
	try {
		await stat(filePath);
		return true;
	} catch {
		return false;
	}
}

function safeName(input: string, fallback: string): string {
	let withoutControlCharacters = "";
	for (const char of input) {
		const code = char.charCodeAt(0);
		if ((code >= 0x20 && code < 0x7f) || code > 0x9f) {
			withoutControlCharacters += char;
		}
	}

	let value = withoutControlCharacters
		.replace(/[<>:"/\\|?*]/g, "_")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/[. ]+$/g, "");

	if (!value) value = fallback;
	if (RESERVED_NAMES.has(value.toUpperCase())) value = `${value}_`;
	if (value.length > MAX_NAME_LENGTH) value = value.slice(0, MAX_NAME_LENGTH);
	return value || fallback;
}

function splitFileName(fileName: string): { stem: string; ext: string } {
	const parsed = path.parse(fileName);
	const stem = parsed.name || parsed.base || "file";
	return { stem, ext: parsed.ext };
}

function pathKey(relPath: string): string {
	return relPath.split(path.sep).join("/").toLowerCase();
}

function toRel(...parts: string[]): string {
	return path
		.join(...parts)
		.split(path.sep)
		.join("/");
}

function shortId(id: string): string {
	return id.replaceAll("-", "").slice(0, 8);
}

function attachmentSignature(attachment: AttachmentMeta): string {
	return [
		"attachment",
		attachment.fileKey,
		attachment.sizeBytes ?? "",
		attachment.createdAt,
		attachment.renamedFile ?? "",
		attachment.originalName,
	].join(":");
}

function textSignature(kind: string, updatedAt: string, id: string): string {
	return [kind, id, updatedAt].join(":");
}

async function readState(taskDir: string): Promise<SyncState | null> {
	try {
		const raw = await readFile(path.join(taskDir, STATE_FILE), "utf8");
		const parsed = JSON.parse(raw) as SyncState;
		if (parsed.version === 1 && typeof parsed.taskId === "string") {
			return parsed;
		}
		return null;
	} catch {
		return null;
	}
}

async function findExistingTaskDir(
	outputDir: string,
	taskId: string,
): Promise<{ taskDir: string; state: SyncState } | null> {
	let entries: string[];
	try {
		entries = await readdir(outputDir);
	} catch {
		return null;
	}

	for (const entry of entries) {
		const taskDir = path.join(outputDir, entry);
		let info: Awaited<ReturnType<typeof stat>>;
		try {
			info = await stat(taskDir);
		} catch {
			continue;
		}
		if (!info.isDirectory()) continue;
		const state = await readState(taskDir);
		if (state?.taskId === taskId) {
			return { taskDir, state };
		}
	}

	return null;
}

async function createTaskDir(
	outputDir: string,
	task: TaskDetail,
): Promise<{ taskDir: string; state: SyncState | null }> {
	await mkdir(outputDir, { recursive: true });

	const existing = await findExistingTaskDir(outputDir, task.id);
	if (existing) return existing;

	const baseName = safeName(
		`${task.title}-${shortId(task.id)}`,
		`task-${task.id}`,
	);
	for (let index = 0; ; index++) {
		const name = index === 0 ? baseName : `${baseName}-${index + 1}`;
		const taskDir = path.join(outputDir, name);
		if (!(await exists(taskDir))) {
			await mkdir(taskDir, { recursive: true });
			return { taskDir, state: null };
		}
	}
}

async function writeFileAtomic(filePath: string, content: string | Buffer) {
	await mkdir(path.dirname(filePath), { recursive: true });
	const tmpPath = path.join(
		path.dirname(filePath),
		`.${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}-${Math.random()
			.toString(16)
			.slice(2)}`,
	);
	await writeFile(tmpPath, content);
	await rename(tmpPath, filePath);
}

async function streamToFileAtomic(url: string, filePath: string) {
	await mkdir(path.dirname(filePath), { recursive: true });
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Download failed with HTTP ${response.status}`);
	}
	if (!response.body) {
		throw new Error("Download failed: empty response body");
	}

	const tmpPath = path.join(
		path.dirname(filePath),
		`.${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}-${Math.random()
			.toString(16)
			.slice(2)}`,
	);

	try {
		await pipeline(
			Readable.fromWeb(response.body as ReadableStream<Uint8Array>),
			createWriteStream(tmpPath),
		);
		await rename(tmpPath, filePath);
	} catch (err) {
		await rm(tmpPath, { force: true });
		throw err;
	}
}

async function presignOne(
	client: TaskFlowClient,
	fileKey: string,
): Promise<PresignResponse> {
	return client.request<PresignResponse>(
		"GET",
		`/files/${encodeURI(fileKey)}/url`,
	);
}

async function mapWithConcurrency<T, R>(
	items: T[],
	concurrency: number,
	worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
	const results = new Array<R>(items.length);
	let nextIndex = 0;

	async function run() {
		while (nextIndex < items.length) {
			const index = nextIndex++;
			results[index] = await worker(items[index], index);
		}
	}

	await Promise.all(
		Array.from({ length: Math.min(concurrency, items.length) }, () => run()),
	);
	return results;
}

async function allocateFileRelPath(input: {
	taskDir: string;
	dirRel: string;
	desiredName: string;
	used: Set<string>;
	previousFiles: Record<string, ManagedFile>;
}): Promise<string> {
	const safe = safeName(input.desiredName, "file");
	const { stem, ext } = splitFileName(safe);

	for (let index = 0; ; index++) {
		const candidateName = index === 0 ? safe : `${stem}-${index + 1}${ext}`;
		const relPath = toRel(input.dirRel, candidateName);
		const key = pathKey(relPath);
		const absPath = path.join(input.taskDir, relPath);
		if (input.used.has(key)) continue;
		if (input.previousFiles[relPath] || !(await exists(absPath))) {
			input.used.add(key);
			return relPath;
		}
	}
}

async function allocateSubmissionDir(input: {
	taskDir: string;
	row: SubmissionListRow;
	submission: SubmissionDetail;
	used: Set<string>;
	previousState: SyncState | null;
}): Promise<string> {
	const previous = input.previousState?.submissions[input.submission.id]?.dir;
	if (previous && !input.used.has(pathKey(previous))) {
		input.used.add(pathKey(previous));
		return previous;
	}

	const label = [
		input.row.nickname ?? "student",
		input.row.studentId ?? "",
		shortId(input.submission.id),
	]
		.filter(Boolean)
		.join("_");
	const baseName = safeName(label, `submission-${input.submission.id}`);

	for (let index = 0; ; index++) {
		const dirName = index === 0 ? baseName : `${baseName}-${index + 1}`;
		const relPath = toRel(SUBMISSIONS_DIR, dirName);
		const key = pathKey(relPath);
		const absPath = path.join(input.taskDir, relPath);
		if (input.used.has(key)) continue;
		if (!(await exists(absPath))) {
			input.used.add(key);
			return relPath;
		}
	}
}

async function syncTextFile(input: {
	absPath: string;
	relPath: string;
	content: string;
	signature: string;
	kind: ManagedFile["kind"];
	sourceId?: string;
	previousState: SyncState | null;
	currentFiles: Record<string, ManagedFile>;
	downloadedFiles: DownloadedFile[];
	skippedFiles: string[];
	source: "task" | "submission";
}) {
	input.currentFiles[input.relPath] = {
		signature: input.signature,
		kind: input.kind,
		sourceId: input.sourceId,
	};

	const previous = input.previousState?.managedFiles[input.relPath];
	if (
		previous?.signature === input.signature &&
		(await exists(input.absPath))
	) {
		input.skippedFiles.push(input.absPath);
		return;
	}

	await writeFileAtomic(input.absPath, input.content);
	input.downloadedFiles.push({ path: input.absPath, source: input.source });
}

async function syncAttachment(input: {
	client: TaskFlowClient;
	taskDir: string;
	relPath: string;
	attachment: AttachmentMeta;
	source: "task" | "submission";
	sourceId?: string;
	previousState: SyncState | null;
	currentFiles: Record<string, ManagedFile>;
	downloadedFiles: DownloadedFile[];
	skippedFiles: string[];
	failedFiles: FailedFile[];
}) {
	const absPath = path.join(input.taskDir, input.relPath);
	const signature = attachmentSignature(input.attachment);
	input.currentFiles[input.relPath] = {
		signature,
		kind: "attachment",
		sourceId: input.sourceId,
		fileKey: input.attachment.fileKey,
	};

	const previous = input.previousState?.managedFiles[input.relPath];
	if (previous?.signature === signature && (await exists(absPath))) {
		input.skippedFiles.push(absPath);
		return;
	}

	try {
		const { url } = await presignOne(input.client, input.attachment.fileKey);
		await streamToFileAtomic(url, absPath);
		input.downloadedFiles.push({
			path: absPath,
			source: input.source,
			fileKey: input.attachment.fileKey,
			bytes: input.attachment.sizeBytes,
		});
	} catch (err) {
		delete input.currentFiles[input.relPath];
		for (const [previousRelPath, previous] of Object.entries(
			input.previousState?.managedFiles ?? {},
		)) {
			if (
				previous.fileKey === input.attachment.fileKey &&
				previous.sourceId === input.sourceId
			) {
				input.currentFiles[previousRelPath] = previous;
			}
		}
		input.failedFiles.push({
			path: absPath,
			source: input.source,
			fileKey: input.attachment.fileKey,
			error: formatError(err),
		});
	}
}

function preservePreviousSubmissionFiles(input: {
	previousState: SyncState | null;
	currentFiles: Record<string, ManagedFile>;
	currentSubmissions: SyncState["submissions"];
	submissionId: string;
}) {
	const previousSubmission =
		input.previousState?.submissions[input.submissionId];
	if (previousSubmission) {
		input.currentSubmissions[input.submissionId] = previousSubmission;
	}

	for (const [relPath, file] of Object.entries(
		input.previousState?.managedFiles ?? {},
	)) {
		if (file.sourceId === input.submissionId) {
			input.currentFiles[relPath] = file;
		}
	}
}

async function pruneEmptyParents(taskDir: string, relPath: string) {
	let current = path.dirname(relPath);
	while (current && current !== "." && current !== path.sep) {
		try {
			await rmdir(path.join(taskDir, current));
		} catch {
			return;
		}
		current = path.dirname(current);
	}
}

async function cleanupStaleFiles(input: {
	taskDir: string;
	previousState: SyncState | null;
	currentFiles: Record<string, ManagedFile>;
	deletedFiles: string[];
}) {
	if (!input.previousState) return;

	for (const relPath of Object.keys(input.previousState.managedFiles)) {
		if (input.currentFiles[relPath]) continue;
		const absPath = path.join(input.taskDir, relPath);
		try {
			await rm(absPath, { force: true });
			input.deletedFiles.push(absPath);
			await pruneEmptyParents(input.taskDir, relPath);
		} catch {
			// Keep syncing other files; stale cleanup can be retried next run.
		}
	}
}

function makeManifest(input: {
	task: TaskDetail;
	submissions: Array<{
		row: SubmissionListRow;
		detail: SubmissionDetail;
		dir: string;
	}>;
	downloadedFiles: DownloadedFile[];
	deletedFiles: string[];
	skippedFiles: string[];
	failedFiles: FailedFile[];
	failedSubmissions: Array<{ submissionId: string; error: string }>;
}) {
	return {
		version: 1,
		syncedAt: new Date().toISOString(),
		task: input.task,
		submissions: input.submissions.map(({ row, detail, dir }) => ({
			dir,
			student: {
				userId: row.userId,
				nickname: row.nickname,
				studentId: row.studentId,
				schoolName: row.schoolName,
				role: row.role,
			},
			submission: detail,
		})),
		summary: {
			submissions: input.submissions.length,
			downloadedFiles: input.downloadedFiles.length,
			deletedFiles: input.deletedFiles.length,
			skippedFiles: input.skippedFiles.length,
			failedFiles: input.failedFiles.length,
			failedSubmissions: input.failedSubmissions.length,
		},
		failures: {
			files: input.failedFiles,
			submissions: input.failedSubmissions,
		},
	};
}

export function registerSyncTools(
	server: McpServer,
	client: TaskFlowClient,
): void {
	server.registerTool(
		"sync_taskflow_task",
		{
			description:
				"Synchronize one TaskFlow task into a local workspace folder. The task directory contains task.md, task.json, task attachments, manifest.json, and submissions/<student_submission>/ folders with each submitted student's content.md, submission.json, and attachments. Re-running this tool incrementally updates changed submissions/files and removes stale files previously created by this tool. Requires an explicit outputDir on the user's machine.",
			inputSchema: {
				taskId: z.string().uuid().describe("Task ID to synchronize"),
				outputDir: z
					.string()
					.min(1)
					.describe(
						"Local parent directory where the task workspace should be created or reused.",
					),
			},
			annotations: {
				readOnlyHint: false,
				destructiveHint: true,
				idempotentHint: true,
				openWorldHint: true,
			},
		},
		async ({ taskId, outputDir }) => {
			try {
				const resolvedOutputDir = path.resolve(outputDir);
				const task = await client.request<TaskDetail>(
					"GET",
					`/tasks/${taskId}`,
				);
				const { taskDir, state: previousState } = await createTaskDir(
					resolvedOutputDir,
					task,
				);

				const rows = await client.request<SubmissionListRow[]>(
					"GET",
					`/tasks/${taskId}/submissions`,
				);
				const submittedRows = rows.filter((row) => row.submission);

				const failedSubmissions: Array<{
					submissionId: string;
					error: string;
				}> = [];
				const detailResults = await mapWithConcurrency(
					submittedRows,
					CONCURRENCY,
					async (row) => {
						const submissionId = row.submission?.id;
						if (!submissionId) return null;
						try {
							const detail = await client.request<SubmissionDetail>(
								"GET",
								`/tasks/${taskId}/submissions/${submissionId}`,
							);
							return { row, detail };
						} catch (err) {
							failedSubmissions.push({
								submissionId,
								error: formatError(err),
							});
							return null;
						}
					},
				);
				const submissionDetails = detailResults.filter(
					(
						result,
					): result is { row: SubmissionListRow; detail: SubmissionDetail } =>
						result !== null,
				);

				const currentFiles: Record<string, ManagedFile> = {};
				const currentSubmissions: SyncState["submissions"] = {};
				const downloadedFiles: DownloadedFile[] = [];
				const deletedFiles: string[] = [];
				const skippedFiles: string[] = [];
				const failedFiles: FailedFile[] = [];
				const usedRootNames = new Set<string>([
					pathKey(TASK_MD_FILE),
					pathKey(TASK_JSON_FILE),
					pathKey(MANIFEST_FILE),
					pathKey(STATE_FILE),
					pathKey(SUBMISSIONS_DIR),
				]);
				const previousFiles = previousState?.managedFiles ?? {};

				for (const failedSubmission of failedSubmissions) {
					preservePreviousSubmissionFiles({
						previousState,
						currentFiles,
						currentSubmissions,
						submissionId: failedSubmission.submissionId,
					});
				}

				await syncTextFile({
					absPath: path.join(taskDir, TASK_MD_FILE),
					relPath: TASK_MD_FILE,
					content: task.description ?? "",
					signature: textSignature("task-content", task.updatedAt, task.id),
					kind: "task-content",
					sourceId: task.id,
					previousState,
					currentFiles,
					downloadedFiles,
					skippedFiles,
					source: "task",
				});
				await syncTextFile({
					absPath: path.join(taskDir, TASK_JSON_FILE),
					relPath: TASK_JSON_FILE,
					content: `${JSON.stringify(task, null, 2)}\n`,
					signature: textSignature("task-json", task.updatedAt, task.id),
					kind: "task-json",
					sourceId: task.id,
					previousState,
					currentFiles,
					downloadedFiles,
					skippedFiles,
					source: "task",
				});

				const taskAttachmentJobs = [];
				for (const attachment of task.attachments) {
					const relPath = await allocateFileRelPath({
						taskDir,
						dirRel: "",
						desiredName: attachment.renamedFile ?? attachment.originalName,
						used: usedRootNames,
						previousFiles,
					});
					taskAttachmentJobs.push({ attachment, relPath });
				}

				await mapWithConcurrency(taskAttachmentJobs, CONCURRENCY, (job) =>
					syncAttachment({
						client,
						taskDir,
						relPath: job.relPath,
						attachment: job.attachment,
						source: "task",
						sourceId: task.id,
						previousState,
						currentFiles,
						downloadedFiles,
						skippedFiles,
						failedFiles,
					}),
				);

				const usedSubmissionDirs = new Set<string>();
				const syncedSubmissions: Array<{
					row: SubmissionListRow;
					detail: SubmissionDetail;
					dir: string;
				}> = [];

				for (const { row, detail } of submissionDetails) {
					const submissionDir = await allocateSubmissionDir({
						taskDir,
						row,
						submission: detail,
						used: usedSubmissionDirs,
						previousState,
					});
					currentSubmissions[detail.id] = {
						dir: submissionDir,
						lastUpdatedAt: detail.lastUpdatedAt,
					};
					syncedSubmissions.push({ row, detail, dir: submissionDir });

					await syncTextFile({
						absPath: path.join(taskDir, submissionDir, "content.md"),
						relPath: toRel(submissionDir, "content.md"),
						content: detail.content ?? "",
						signature: textSignature(
							"submission-content",
							detail.lastUpdatedAt,
							detail.id,
						),
						kind: "submission-content",
						sourceId: detail.id,
						previousState,
						currentFiles,
						downloadedFiles,
						skippedFiles,
						source: "submission",
					});
					await syncTextFile({
						absPath: path.join(taskDir, submissionDir, "submission.json"),
						relPath: toRel(submissionDir, "submission.json"),
						content: `${JSON.stringify({ student: row, submission: detail }, null, 2)}\n`,
						signature: textSignature(
							"submission-json",
							detail.lastUpdatedAt,
							detail.id,
						),
						kind: "submission-json",
						sourceId: detail.id,
						previousState,
						currentFiles,
						downloadedFiles,
						skippedFiles,
						source: "submission",
					});
				}

				const submissionAttachmentJobs: Array<{
					attachment: AttachmentMeta;
					relPath: string;
					submissionId: string;
				}> = [];
				for (const { detail, dir } of syncedSubmissions) {
					const usedSubmissionFileNames = new Set<string>([
						pathKey(toRel(dir, "content.md")),
						pathKey(toRel(dir, "submission.json")),
					]);
					for (const attachment of detail.attachments) {
						const relPath = await allocateFileRelPath({
							taskDir,
							dirRel: dir,
							desiredName: attachment.renamedFile ?? attachment.originalName,
							used: usedSubmissionFileNames,
							previousFiles,
						});
						submissionAttachmentJobs.push({
							attachment,
							relPath,
							submissionId: detail.id,
						});
					}
				}

				await mapWithConcurrency(submissionAttachmentJobs, CONCURRENCY, (job) =>
					syncAttachment({
						client,
						taskDir,
						relPath: job.relPath,
						attachment: job.attachment,
						source: "submission",
						sourceId: job.submissionId,
						previousState,
						currentFiles,
						downloadedFiles,
						skippedFiles,
						failedFiles,
					}),
				);

				const manifestRelPath = MANIFEST_FILE;
				currentFiles[manifestRelPath] = {
					signature: `manifest:${new Date().toISOString()}`,
					kind: "manifest",
					sourceId: task.id,
				};

				await cleanupStaleFiles({
					taskDir,
					previousState,
					currentFiles,
					deletedFiles,
				});

				const manifest = makeManifest({
					task,
					submissions: syncedSubmissions,
					downloadedFiles,
					deletedFiles,
					skippedFiles,
					failedFiles,
					failedSubmissions,
				});
				await writeFileAtomic(
					path.join(taskDir, manifestRelPath),
					`${JSON.stringify(manifest, null, 2)}\n`,
				);

				const nextState: SyncState = {
					version: 1,
					taskId,
					taskDirName: path.basename(taskDir),
					managedFiles: currentFiles,
					submissions: currentSubmissions,
					lastSyncedAt: new Date().toISOString(),
				};
				await writeFileAtomic(
					path.join(taskDir, STATE_FILE),
					`${JSON.stringify(nextState, null, 2)}\n`,
				);

				const data: SyncResult = {
					taskId,
					taskDir,
					manifestPath: path.join(taskDir, MANIFEST_FILE),
					syncedSubmissions: syncedSubmissions.length,
					downloadedFiles,
					deletedFiles,
					skippedFiles,
					failedFiles,
					failedSubmissions,
				};
				return resultWithStructured(data);
			} catch (err) {
				return errorResult(err);
			}
		},
	);
}
