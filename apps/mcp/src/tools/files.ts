import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TaskFlowApiError, type TaskFlowClient } from "../client.js";

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

function jsonResult(data: unknown) {
	return {
		content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
	};
}

interface AttachmentMeta {
	id: string;
	fileKey: string;
	originalName: string;
	renamedFile: string | null;
	mimeType: string | null;
	sizeBytes: number | null;
	createdAt: string;
}

interface PresignResponse {
	url: string;
	expiresIn: number;
}

interface DownloadEntry {
	fileKey: string;
	originalName?: string;
	mimeType?: string | null;
	sizeBytes?: number | null;
	url: string;
	expiresIn: number;
}

interface FailedEntry {
	fileKey: string;
	error: string;
}

const MAX_FILES = 50;

async function presignOne(
	client: TaskFlowClient,
	fileKey: string,
): Promise<PresignResponse> {
	return client.request<PresignResponse>(
		"GET",
		`/files/${encodeURI(fileKey)}/url`,
	);
}

interface MetaInput {
	fileKey: string;
	originalName?: string;
	mimeType?: string | null;
	sizeBytes?: number | null;
}

async function presignAll(
	client: TaskFlowClient,
	metas: MetaInput[],
): Promise<{ attachments: DownloadEntry[]; failed: FailedEntry[] }> {
	const results = await Promise.all(
		metas.map(async (m) => {
			try {
				const presigned = await presignOne(client, m.fileKey);
				const entry: DownloadEntry = {
					fileKey: m.fileKey,
					url: presigned.url,
					expiresIn: presigned.expiresIn,
				};
				if (m.originalName !== undefined) entry.originalName = m.originalName;
				if (m.mimeType !== undefined) entry.mimeType = m.mimeType;
				if (m.sizeBytes !== undefined) entry.sizeBytes = m.sizeBytes;
				return { ok: true as const, entry };
			} catch (err) {
				return {
					ok: false as const,
					failed: { fileKey: m.fileKey, error: formatError(err) },
				};
			}
		}),
	);
	const attachments: DownloadEntry[] = [];
	const failed: FailedEntry[] = [];
	for (const r of results) {
		if (r.ok) attachments.push(r.entry);
		else failed.push(r.failed);
	}
	return { attachments, failed };
}

export function registerFileTools(
	server: McpServer,
	client: TaskFlowClient,
): void {
	server.registerTool(
		"download_attachments",
		{
			description:
				"Get presigned download URLs for attachments. Use these URLs with your HTTP download tools (WebFetch, curl, etc.) to fetch file contents — URLs work without auth headers and expire in 5 minutes.\n\nThree input modes (provide exactly one):\n- taskId: returns URLs for all attachments on a task (class-level reference materials)\n- taskId + submissionId: returns URLs for all files a student uploaded to a submission (use this for auto-grading)\n- fileKeys: returns URLs for specific fileKeys you already know about\n\nThe tool presigns URLs in parallel, so large batches are fast. Individual failures are reported in the `failed` array without breaking the rest of the response. Max 50 fileKeys per call.",
			inputSchema: {
				taskId: z
					.string()
					.uuid()
					.optional()
					.describe(
						"Task ID — returns all task attachments. Combine with submissionId for submission files.",
					),
				submissionId: z
					.string()
					.uuid()
					.optional()
					.describe(
						"Submission ID — must be paired with taskId. Returns student-uploaded files.",
					),
				fileKeys: z
					.array(z.string().min(1))
					.max(MAX_FILES)
					.optional()
					.describe(
						"Specific fileKeys from earlier task/submission responses. Max 50 per call.",
					),
			},
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
				idempotentHint: true,
				openWorldHint: true,
			},
		},
		async ({ taskId, submissionId, fileKeys }) => {
			try {
				// Validate exactly one mode
				const modes = [
					taskId && !submissionId ? "task" : null,
					submissionId ? "submission" : null,
					fileKeys && fileKeys.length > 0 ? "fileKeys" : null,
				].filter(Boolean);

				if (modes.length === 0) {
					return errorResult(
						new Error(
							"Provide one of: taskId, (taskId + submissionId), or fileKeys[].",
						),
					);
				}
				if (modes.length > 1) {
					return errorResult(
						new Error(
							"Provide exactly one mode: taskId OR (taskId + submissionId) OR fileKeys[].",
						),
					);
				}
				if (submissionId && !taskId) {
					return errorResult(
						new Error("submissionId requires taskId to be set as well."),
					);
				}

				// Mode: submission
				if (submissionId && taskId) {
					const submission = await client.request<{
						attachments: AttachmentMeta[];
					}>("GET", `/tasks/${taskId}/submissions/${submissionId}`);
					const { attachments, failed } = await presignAll(
						client,
						submission.attachments,
					);
					return jsonResult({
						source: { submissionId, taskId },
						count: attachments.length,
						attachments,
						failed,
					});
				}

				// Mode: task
				if (taskId) {
					const task = await client.request<{ attachments: AttachmentMeta[] }>(
						"GET",
						`/tasks/${taskId}`,
					);
					const { attachments, failed } = await presignAll(
						client,
						task.attachments,
					);
					return jsonResult({
						source: { taskId },
						count: attachments.length,
						attachments,
						failed,
					});
				}

				// Mode: fileKeys
				if (fileKeys) {
					const metas: MetaInput[] = fileKeys.map((fileKey) => ({ fileKey }));
					const { attachments, failed } = await presignAll(client, metas);
					return jsonResult({
						source: { fileKeys: true },
						count: attachments.length,
						attachments,
						failed,
					});
				}

				return errorResult(new Error("Unreachable"));
			} catch (err) {
				return errorResult(err);
			}
		},
	);
}
