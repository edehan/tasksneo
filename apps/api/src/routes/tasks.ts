import { prisma } from "@taskflow/db";
import { Hono } from "hono";
import { z } from "zod";
import { requireAuthUser } from "../lib/context.js";
import { AppError } from "../lib/errors.js";
import {
	createSubmissionAttachmentObjectKey,
	createTaskAttachmentObjectKey,
	getPresignedPutUrl,
	getTaskAttachmentPresignedUrl,
	statObject,
} from "../lib/storage.js";
import { authMiddleware } from "../middleware/auth.js";
import {
	assertParseInput,
	buildParseTaskContext,
	parseTaskContent,
	parseTaskDescription,
	reviseTaskContent,
} from "../services/ai.service.js";
import {
	createComment,
	listTaskComments,
} from "../services/comment.service.js";
import {
	addSubmissionAttachments,
	addTaskAttachments,
	assertCanUploadSubmissionAttachments,
	assertCanUploadTaskAttachments,
	deleteTask,
	exportTaskSubmissionsCsv,
	getMySubmission,
	getTaskDetail,
	getTaskImportCandidateDetail,
	getTaskSubmissionDetail,
	gradeSubmission,
	importTaskIntoDraft,
	listTaskImportCandidates,
	listMyTasks,
	listTaskSubmissions,
	markTaskViewed,
	publishTask,
	renameTaskSubmissionAttachments,
	toggleExemplary,
	updateTask,
	updateTaskUserState,
	upsertMySubmissionContent,
} from "../services/task.service.js";
import {
	deleteTaskDraftMarkdown,
	getTaskDraftMarkdown,
	setTaskDraftMarkdown,
} from "../services/task-draft-cache.service.js";

import type { AppVariables } from "../types/context.js";

const parseSchema = z.object({
	text: z.string().min(1),
});

const taskIdParamSchema = z.object({
	taskId: z.string().uuid(),
});

const importCandidatesQuerySchema = z.object({
	classId: z.string().uuid().optional(),
	sort: z.enum(["updatedAt", "createdAt"]).optional(),
});

const gradeParamSchema = z.object({
	taskId: z.string().uuid(),
	submissionId: z.string().uuid(),
});

const updateTaskBodySchema = z.object({
	title: z.string().trim().min(1).optional(),
	description: z.string().optional().nullable(),
	sourceText: z.string().optional().nullable(),
	startAt: z.string().datetime().optional().nullable(),
	dueAt: z.string().datetime().optional().nullable(),
	allowLateSubmission: z.boolean().optional(),
	blockedBy: z.array(z.string().uuid()).optional(),
});

const parseDraftTaskBodySchema = z.object({
	text: z.string().trim().min(1).optional(),
});

const reviseBodySchema = z.object({
	currentContent: z.string().min(1),
	instruction: z.string().min(1),
});

const updateStateSchema = z.object({
	tags: z.array(z.string()).optional(),
	sortOrder: z.number().optional(),
});

const gradeBodySchema = z.object({
	score: z.string().optional().nullable(),
	reviewNote: z.string().optional().nullable(),
});

const upsertSubmissionBodySchema = z.object({
	content: z.string().nullable(),
});

const importTaskBodySchema = z.object({
	sourceTaskId: z.string().uuid(),
});

const MAX_UPLOAD_FILES = 50;
const DIRECT_UPLOAD_EXPIRES_SECONDS = 300;

const directUploadFileSchema = z.object({
	name: z.string().trim().min(1).max(255),
	mimeType: z.string().trim().min(1).max(255).nullable().optional(),
	sizeBytes: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});

const directUploadUrlBodySchema = z.object({
	files: z.array(directUploadFileSchema).min(1).max(MAX_UPLOAD_FILES),
});

const completedAttachmentSchema = z.object({
	fileKey: z.string().trim().min(1).max(1024),
	originalName: z.string().trim().min(1).max(255),
	mimeType: z.string().trim().min(1).max(255).nullable().optional(),
	sizeBytes: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});

const taskAttachmentCompletionSchema = z.object({
	attachments: z.array(completedAttachmentSchema).min(1).max(MAX_UPLOAD_FILES),
	isVisible: z.boolean().optional(),
});

const submissionAttachmentCompletionSchema = z.object({
	attachments: z.array(completedAttachmentSchema).min(1).max(MAX_UPLOAD_FILES),
});

type CompletedAttachmentInput = z.infer<typeof completedAttachmentSchema>;

function getUploadHeaders(mimeType: string | null | undefined) {
	return mimeType ? { "Content-Type": mimeType } : {};
}

async function validateCompletedUploads(
	attachments: CompletedAttachmentInput[],
	expectedPrefix: string,
) {
	const records: Array<{
		fileKey: string;
		originalName: string;
		mimeType: string | null;
		sizeBytes: bigint;
	}> = [];

	for (const attachment of attachments) {
		if (!attachment.fileKey.startsWith(expectedPrefix)) {
			throw new AppError(
				400,
				"VALIDATION_ERROR",
				"fileKey does not match this upload context",
			);
		}

		const objectInfo = await statObject(attachment.fileKey);

		if (!objectInfo) {
			throw new AppError(
				400,
				"UPLOAD_NOT_FOUND",
				"Uploaded object was not found",
			);
		}

		if (objectInfo.size !== attachment.sizeBytes) {
			throw new AppError(
				400,
				"UPLOAD_SIZE_MISMATCH",
				"Uploaded object size does not match metadata",
			);
		}

		records.push({
			fileKey: attachment.fileKey,
			originalName: attachment.originalName,
			mimeType: attachment.mimeType ?? null,
			sizeBytes: BigInt(attachment.sizeBytes),
		});
	}

	return records;
}

export const tasksRouter = new Hono<{ Variables: AppVariables }>();

tasksRouter.use("*", authMiddleware);

tasksRouter.get("/mine", async (c) => {
	const authUser = requireAuthUser(c);
	const tasks = await listMyTasks(authUser.userId);
	return c.json(tasks, 200);
});

tasksRouter.post("/parse", async (c) => {
	const authUser = requireAuthUser(c);
	const body = parseSchema.parse(await c.req.json());
	const user = await prisma.user.findUnique({
		where: { id: authUser.userId },
		select: { timezone: true },
	});
	const result = await parseTaskDescription(
		body.text,
		buildParseTaskContext(user?.timezone),
	);
	return c.json(
		{
			title: result.title,
			timeOptions: result.timeOptions,
			allowLateSubmission: result.allowLateSubmission,
			description: result.description,
		},
		200,
	);
});

tasksRouter.get("/import-candidates", async (c) => {
	const authUser = requireAuthUser(c);
	const query = importCandidatesQuerySchema.parse(c.req.query());
	const tasks = await listTaskImportCandidates(authUser.userId, query);
	return c.json({ tasks }, 200);
});

tasksRouter.get("/import-candidates/:taskId", async (c) => {
	const authUser = requireAuthUser(c);
	const params = taskIdParamSchema.parse(c.req.param());
	const task = await getTaskImportCandidateDetail(
		authUser.userId,
		params.taskId,
	);
	return c.json(task, 200);
});

tasksRouter.get("/:taskId", async (c) => {
	const authUser = requireAuthUser(c);
	const params = taskIdParamSchema.parse(c.req.param());
	const task = await getTaskDetail(params.taskId, authUser.userId);
	return c.json(task, 200);
});

tasksRouter.patch("/:taskId", async (c) => {
	const authUser = requireAuthUser(c);
	const params = taskIdParamSchema.parse(c.req.param());
	const body = updateTaskBodySchema.parse(await c.req.json());
	const task = await updateTask(params.taskId, authUser.userId, body);
	return c.json(task, 200);
});

tasksRouter.post("/:taskId/import", async (c) => {
	const authUser = requireAuthUser(c);
	const params = taskIdParamSchema.parse(c.req.param());
	const body = importTaskBodySchema.parse(await c.req.json());
	const result = await importTaskIntoDraft(
		params.taskId,
		authUser.userId,
		body.sourceTaskId,
	);
	return c.json(result, 201);
});

tasksRouter.post("/:taskId/parse", async (c) => {
	const authUser = requireAuthUser(c);
	const params = taskIdParamSchema.parse(c.req.param());
	const body = parseDraftTaskBodySchema.parse(await c.req.json());

	const [user, task] = await Promise.all([
		prisma.user.findUnique({
			where: { id: authUser.userId },
			select: { timezone: true },
		}),
		prisma.task.findUnique({
			where: { id: params.taskId },
			select: {
				id: true,
				classId: true,
				sourceText: true,
				class: {
					select: {
						name: true,
						description: true,
						taskAiPrompt: true,
					},
				},
			},
		}),
	]);

	if (!task) {
		throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
	}

	if (!task.classId) {
		throw new AppError(403, "FORBIDDEN", "Only class admin can parse task");
	}

	// Membership check + attachment fetch in parallel (both need task.classId / task.id)
	const [membership, attachments] = await Promise.all([
		prisma.classMember.findUnique({
			where: {
				classId_userId: {
					classId: task.classId,
					userId: authUser.userId,
				},
			},
		}),
		prisma.attachment.findMany({
			where: { taskId: task.id },
			select: {
				originalName: true,
				mimeType: true,
				fileKey: true,
				sizeBytes: true,
			},
		}),
	]);

	if (
		!membership ||
		(membership.role !== "OWNER" && membership.role !== "ADMIN")
	) {
		throw new AppError(403, "FORBIDDEN", "Only class admin can parse task");
	}

	const text = body.text ?? task.sourceText ?? "";
	assertParseInput(text, { attachmentCount: attachments.length });

	// Generate presigned URLs in parallel — no byte downloads
	const apiOrigin = new URL(c.req.url).origin;
	const attachmentPayload = await Promise.all(
		attachments.map(async (att) => ({
			originalName: att.originalName,
			mimeType: att.mimeType,
			presignedUrl: await getTaskAttachmentPresignedUrl(att.fileKey),
			appUrl: `${apiOrigin}/files/${att.fileKey}`,
			sizeBytes: att.sizeBytes != null ? Number(att.sizeBytes) : undefined,
		})),
	);

	const parsed = await parseTaskContent({
		text,
		context: buildParseTaskContext(user?.timezone),
		attachments: attachmentPayload,
		classContext: task.class
			? {
					name: task.class.name,
					description: task.class.description,
					taskAiPrompt: task.class.taskAiPrompt,
				}
			: undefined,
	});

	// Update task with first time option as default
	const firstOption = parsed.structured.timeOptions[0];
	await Promise.all([
		updateTask(task.id, authUser.userId, {
			sourceText: text,
			title: parsed.structured.title ?? undefined,
			startAt: firstOption ? firstOption.startAt : undefined,
			dueAt: firstOption ? firstOption.dueAt : undefined,
			allowLateSubmission: parsed.structured.allowLateSubmission ?? undefined,
			description: parsed.structured.description ?? undefined,
		}),
		parsed.markdown
			? setTaskDraftMarkdown(task.id, parsed.markdown)
			: Promise.resolve(),
	]);

	return c.json(
		{
			title: parsed.structured.title,
			timeOptions: parsed.structured.timeOptions,
			allowLateSubmission: parsed.structured.allowLateSubmission,
			description: parsed.structured.description,
			markdownCached: Boolean(parsed.markdown),
		},
		200,
	);
});

// ─── Revise task content with AI ─────────────────────────────────────────────

tasksRouter.post("/:taskId/revise", async (c) => {
	const authUser = requireAuthUser(c);
	const params = taskIdParamSchema.parse(c.req.param());
	const body = reviseBodySchema.parse(await c.req.json());

	const [user, task] = await Promise.all([
		prisma.user.findUnique({
			where: { id: authUser.userId },
			select: { timezone: true },
		}),
		prisma.task.findUnique({
			where: { id: params.taskId },
			select: {
				id: true,
				classId: true,
				class: {
					select: {
						name: true,
						description: true,
						taskAiPrompt: true,
					},
				},
			},
		}),
	]);

	if (!task) {
		throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
	}

	if (!task.classId) {
		throw new AppError(403, "FORBIDDEN", "Only class admin can revise task");
	}

	const membership = await prisma.classMember.findUnique({
		where: {
			classId_userId: {
				classId: task.classId,
				userId: authUser.userId,
			},
		},
	});

	if (
		!membership ||
		(membership.role !== "OWNER" && membership.role !== "ADMIN")
	) {
		throw new AppError(403, "FORBIDDEN", "Only class admin can revise task");
	}

	const result = await reviseTaskContent({
		currentContent: body.currentContent,
		instruction: body.instruction,
		context: buildParseTaskContext(user?.timezone),
		classContext: task.class
			? {
					name: task.class.name,
					description: task.class.description,
					taskAiPrompt: task.class.taskAiPrompt,
				}
			: undefined,
	});

	return c.json(result, 200);
});

tasksRouter.get("/:taskId/draft-markdown", async (c) => {
	const authUser = requireAuthUser(c);
	const params = taskIdParamSchema.parse(c.req.param());

	const task = await prisma.task.findUnique({
		where: { id: params.taskId },
		select: {
			id: true,
			classId: true,
		},
	});

	if (!task) {
		throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
	}

	if (!task.classId) {
		throw new AppError(
			403,
			"FORBIDDEN",
			"Only class admin can read draft markdown",
		);
	}

	const membership = await prisma.classMember.findUnique({
		where: {
			classId_userId: {
				classId: task.classId,
				userId: authUser.userId,
			},
		},
	});

	if (
		!membership ||
		(membership.role !== "OWNER" && membership.role !== "ADMIN")
	) {
		throw new AppError(
			403,
			"FORBIDDEN",
			"Only class admin can read draft markdown",
		);
	}

	const markdown = await getTaskDraftMarkdown(task.id);
	return c.json({ markdown }, 200);
});

tasksRouter.post("/:taskId/publish", async (c) => {
	const authUser = requireAuthUser(c);
	const params = taskIdParamSchema.parse(c.req.param());
	const body = updateTaskBodySchema.parse(await c.req.json());
	const task = await publishTask(params.taskId, authUser.userId, body);
	await deleteTaskDraftMarkdown(params.taskId);
	return c.json(task, 200);
});

tasksRouter.delete("/:taskId", async (c) => {
	const authUser = requireAuthUser(c);
	const params = taskIdParamSchema.parse(c.req.param());
	await deleteTask(params.taskId, authUser.userId);
	return c.body(null, 204);
});

tasksRouter.post("/:taskId/view", async (c) => {
	const authUser = requireAuthUser(c);
	const params = taskIdParamSchema.parse(c.req.param());
	await markTaskViewed(params.taskId, authUser.userId);
	return c.body(null, 204);
});

tasksRouter.patch("/:taskId/state", async (c) => {
	const authUser = requireAuthUser(c);
	const params = taskIdParamSchema.parse(c.req.param());
	const body = updateStateSchema.parse(await c.req.json());
	const state = await updateTaskUserState(params.taskId, authUser.userId, body);
	return c.json(state, 200);
});

tasksRouter.get("/:taskId/submissions", async (c) => {
	const authUser = requireAuthUser(c);
	const params = taskIdParamSchema.parse(c.req.param());
	const rows = await listTaskSubmissions(params.taskId, authUser.userId);
	return c.json(rows, 200);
});

tasksRouter.get("/:taskId/submissions/me", async (c) => {
	const authUser = requireAuthUser(c);
	const params = taskIdParamSchema.parse(c.req.param());
	const submission = await getMySubmission(params.taskId, authUser.userId);

	if (!submission) {
		return c.body(null, 204);
	}

	return c.json(submission, 200);
});

tasksRouter.put("/:taskId/submissions/me", async (c) => {
	const authUser = requireAuthUser(c);
	const params = taskIdParamSchema.parse(c.req.param());
	const body = upsertSubmissionBodySchema.parse(await c.req.json());
	const submission = await upsertMySubmissionContent(
		params.taskId,
		authUser.userId,
		body.content,
	);
	return c.json(submission, 200);
});

tasksRouter.patch("/:taskId/submissions/:submissionId/grade", async (c) => {
	const authUser = requireAuthUser(c);
	const params = gradeParamSchema.parse(c.req.param());
	const body = gradeBodySchema.parse(await c.req.json());
	const submission = await gradeSubmission(
		params.taskId,
		params.submissionId,
		authUser.userId,
		body,
	);
	return c.json(submission, 200);
});

tasksRouter.get("/:taskId/submissions/export", async (c) => {
	const authUser = requireAuthUser(c);
	const params = taskIdParamSchema.parse(c.req.param());
	const csv = await exportTaskSubmissionsCsv(params.taskId, authUser.userId);

	c.header("Content-Type", "text/csv; charset=utf-8");
	c.header(
		"Content-Disposition",
		`attachment; filename=task-${params.taskId}-submissions.csv`,
	);

	return c.body(csv, 200);
});

tasksRouter.get("/:taskId/submissions/:submissionId", async (c) => {
	const authUser = requireAuthUser(c);
	const params = gradeParamSchema.parse(c.req.param());
	const submission = await getTaskSubmissionDetail(
		params.taskId,
		params.submissionId,
		authUser.userId,
	);
	return c.json(submission, 200);
});

tasksRouter.post("/:taskId/attachments/upload-url", async (c) => {
	const authUser = requireAuthUser(c);
	const params = taskIdParamSchema.parse(c.req.param());
	const body = directUploadUrlBodySchema.parse(await c.req.json());

	await assertCanUploadTaskAttachments(params.taskId, authUser.userId);

	const uploads = await Promise.all(
		body.files.map(async (file) => {
			const fileKey = createTaskAttachmentObjectKey(params.taskId, file.name);
			return {
				fileKey,
				uploadUrl: await getPresignedPutUrl(
					fileKey,
					DIRECT_UPLOAD_EXPIRES_SECONDS,
				),
				expiresIn: DIRECT_UPLOAD_EXPIRES_SECONDS,
				headers: getUploadHeaders(file.mimeType),
			};
		}),
	);

	return c.json(uploads, 200);
});

tasksRouter.post("/:taskId/attachments", async (c) => {
	const authUser = requireAuthUser(c);
	const params = taskIdParamSchema.parse(c.req.param());
	const body = taskAttachmentCompletionSchema.parse(await c.req.json());

	await assertCanUploadTaskAttachments(params.taskId, authUser.userId);

	const records = await validateCompletedUploads(
		body.attachments,
		`tasks/${params.taskId}/`,
	);
	const attachments = await addTaskAttachments(
		params.taskId,
		authUser.userId,
		records,
		body.isVisible ?? true,
	);

	return c.json(attachments, 201);
});

tasksRouter.post(
	"/:taskId/submissions/me/attachments/upload-url",
	async (c) => {
		const authUser = requireAuthUser(c);
		const params = taskIdParamSchema.parse(c.req.param());
		const body = directUploadUrlBodySchema.parse(await c.req.json());

		await assertCanUploadSubmissionAttachments(params.taskId, authUser.userId);

		const uploads = await Promise.all(
			body.files.map(async (file) => {
				const fileKey = createSubmissionAttachmentObjectKey(
					params.taskId,
					authUser.userId,
					file.name,
				);
				return {
					fileKey,
					uploadUrl: await getPresignedPutUrl(
						fileKey,
						DIRECT_UPLOAD_EXPIRES_SECONDS,
					),
					expiresIn: DIRECT_UPLOAD_EXPIRES_SECONDS,
					headers: getUploadHeaders(file.mimeType),
				};
			}),
		);

		return c.json(uploads, 200);
	},
);

tasksRouter.post("/:taskId/submissions/me/attachments", async (c) => {
	const authUser = requireAuthUser(c);
	const params = taskIdParamSchema.parse(c.req.param());
	const body = submissionAttachmentCompletionSchema.parse(await c.req.json());

	await assertCanUploadSubmissionAttachments(params.taskId, authUser.userId);

	const records = await validateCompletedUploads(
		body.attachments,
		`submissions/${params.taskId}/${authUser.userId}/`,
	);
	const attachments = await addSubmissionAttachments(
		params.taskId,
		authUser.userId,
		records,
	);

	return c.json(attachments, 201);
});

tasksRouter.patch("/:taskId/submissions/:submissionId/exemplary", async (c) => {
	const authUser = requireAuthUser(c);
	const params = gradeParamSchema.parse(c.req.param());
	const submission = await toggleExemplary(
		params.taskId,
		params.submissionId,
		authUser.userId,
	);
	return c.json(submission, 200);
});

tasksRouter.post("/:taskId/submissions/rename", async (c) => {
	const authUser = requireAuthUser(c);
	const params = taskIdParamSchema.parse(c.req.param());
	await renameTaskSubmissionAttachments(params.taskId, authUser.userId);
	return c.body(null, 204);
});

// ── Comments ──────────────────────────────────────────────────────────────

const createCommentSchema = z.object({
	content: z.string().trim().min(1).max(2000),
	replyToId: z.string().uuid().nullable().optional(),
});

tasksRouter.get("/:taskId/comments", async (c) => {
	const authUser = requireAuthUser(c);
	const params = taskIdParamSchema.parse(c.req.param());
	const comments = await listTaskComments(params.taskId, authUser.userId);
	return c.json({ comments });
});

tasksRouter.post("/:taskId/comments", async (c) => {
	const authUser = requireAuthUser(c);
	const params = taskIdParamSchema.parse(c.req.param());
	const body = createCommentSchema.parse(await c.req.json());
	const comment = await createComment(
		params.taskId,
		authUser.userId,
		body.content,
		body.replyToId,
	);
	return c.json(comment, 201);
});
