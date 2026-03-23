import { prisma } from '@taskflow/db';
import { Hono } from 'hono';
import { z } from 'zod';

import { AppError } from '../lib/errors.js';
import { requireAuthUser } from '../lib/context.js';
import { getObjectBuffer, uploadObject } from '../lib/storage.js';
import { authMiddleware } from '../middleware/auth.js';
import { assertParseInput, buildParseTaskContext, parseTaskContent, parseTaskDescription } from '../services/ai.service.js';
import { deleteTaskDraftMarkdown, getTaskDraftMarkdown, setTaskDraftMarkdown } from '../services/task-draft-cache.service.js';
import {
  addSubmissionAttachments,
  addTaskAttachments,
  deleteTask,
  exportTaskSubmissionsCsv,
  getMySubmission,
  getSubmissionById,
  getTaskSubmissionDetail,
  getTaskDetail,
  gradeSubmission,
  listMyTasks,
  listTaskSubmissions,
  markTaskViewed,
  publishTask,
  renameTaskSubmissionAttachments,
  updateTask,
  updateTaskUserState,
  upsertMySubmissionContent,
} from '../services/task.service.js';

import type { AppVariables } from '../types/context.js';

const parseSchema = z.object({
  text: z.string().min(1),
});

const taskIdParamSchema = z.object({
  taskId: z.string().uuid(),
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

async function parseFilesFromFormData(formData: FormData, parentType: string, parentId: string) {
  const rawFiles = formData.getAll('files');
  const singleFile = formData.get('file');

  if (singleFile instanceof File) {
    rawFiles.push(singleFile);
  }

  if (rawFiles.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'files is required');
  }

  const records: Array<{
    fileKey: string;
    originalName: string;
    mimeType: string | null;
    sizeBytes: bigint;
  }> = [];

  for (const rawFile of rawFiles) {
    if (!(rawFile instanceof File)) {
      continue;
    }

    const bytes = Buffer.from(await rawFile.arrayBuffer());
    const fileKey = await uploadObject(parentType, parentId, rawFile.name, bytes, rawFile.type || undefined);

    records.push({
      fileKey,
      originalName: rawFile.name,
      mimeType: rawFile.type || null,
      sizeBytes: BigInt(bytes.byteLength),
    });
  }

  if (records.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'files is required');
  }

  return records;
}

export const tasksRouter = new Hono<{ Variables: AppVariables }>();

tasksRouter.use('*', authMiddleware);

tasksRouter.get('/mine', async (c) => {
  const authUser = requireAuthUser(c);
  const tasks = await listMyTasks(authUser.userId);
  return c.json(tasks, 200);
});

tasksRouter.post('/parse', async (c) => {
  const authUser = requireAuthUser(c);
  const body = parseSchema.parse(await c.req.json());
  const user = await prisma.user.findUnique({
    where: { id: authUser.userId },
    select: { timezone: true },
  });
  const result = await parseTaskDescription(body.text, buildParseTaskContext(user?.timezone));
  return c.json(result, 200);
});

tasksRouter.get('/:taskId', async (c) => {
  const authUser = requireAuthUser(c);
  const params = taskIdParamSchema.parse(c.req.param());
  const task = await getTaskDetail(params.taskId, authUser.userId);
  return c.json(task, 200);
});

tasksRouter.patch('/:taskId', async (c) => {
  const authUser = requireAuthUser(c);
  const params = taskIdParamSchema.parse(c.req.param());
  const body = updateTaskBodySchema.parse(await c.req.json());
  const task = await updateTask(params.taskId, authUser.userId, body);
  return c.json(task, 200);
});

tasksRouter.post('/:taskId/parse', async (c) => {
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
      },
    }),
  ]);

  if (!task) {
    throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found');
  }

  if (!task.classId) {
    throw new AppError(403, 'FORBIDDEN', 'Only class admin can parse task');
  }

  const membership = await prisma.classMember.findUnique({
    where: {
      classId_userId: {
        classId: task.classId,
        userId: authUser.userId,
      },
    },
  });

  if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
    throw new AppError(403, 'FORBIDDEN', 'Only class admin can parse task');
  }

  const text = body.text ?? task.sourceText ?? '';
  assertParseInput(text);

  const attachments = await prisma.attachment.findMany({
    where: { taskId: task.id },
    select: {
      originalName: true,
      mimeType: true,
      fileKey: true,
    },
  });

  const attachmentPayload = [] as Array<{
    originalName: string;
    mimeType: string | null;
    bytes: Buffer;
  }>;

  for (const attachment of attachments) {
    const bytes = await getObjectBuffer(attachment.fileKey);

    if (!bytes) {
      continue;
    }

    attachmentPayload.push({
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      bytes,
    });
  }

  const parsed = await parseTaskContent({
    text,
    context: buildParseTaskContext(user?.timezone),
    attachments: attachmentPayload,
  });

  await updateTask(task.id, authUser.userId, {
    sourceText: text,
    title: parsed.structured.title ?? undefined,
    startAt: parsed.structured.startAt ?? undefined,
    dueAt: parsed.structured.dueAt ?? undefined,
    description: parsed.structured.description ?? undefined,
  });

  if (parsed.markdown) {
    await setTaskDraftMarkdown(task.id, parsed.markdown);
  }

  return c.json({
    ...parsed.structured,
    markdownCached: Boolean(parsed.markdown),
  }, 200);
});

tasksRouter.get('/:taskId/draft-markdown', async (c) => {
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
    throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found');
  }

  if (!task.classId) {
    throw new AppError(403, 'FORBIDDEN', 'Only class admin can read draft markdown');
  }

  const membership = await prisma.classMember.findUnique({
    where: {
      classId_userId: {
        classId: task.classId,
        userId: authUser.userId,
      },
    },
  });

  if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
    throw new AppError(403, 'FORBIDDEN', 'Only class admin can read draft markdown');
  }

  const markdown = await getTaskDraftMarkdown(task.id);
  return c.json({ markdown }, 200);
});

tasksRouter.post('/:taskId/publish', async (c) => {
  const authUser = requireAuthUser(c);
  const params = taskIdParamSchema.parse(c.req.param());
  const body = updateTaskBodySchema.parse(await c.req.json());
  const task = await publishTask(params.taskId, authUser.userId, body);
  await deleteTaskDraftMarkdown(params.taskId);
  return c.json(task, 200);
});

tasksRouter.delete('/:taskId', async (c) => {
  const authUser = requireAuthUser(c);
  const params = taskIdParamSchema.parse(c.req.param());
  await deleteTask(params.taskId, authUser.userId);
  return c.body(null, 204);
});

tasksRouter.post('/:taskId/view', async (c) => {
  const authUser = requireAuthUser(c);
  const params = taskIdParamSchema.parse(c.req.param());
  await markTaskViewed(params.taskId, authUser.userId);
  return c.body(null, 204);
});

tasksRouter.patch('/:taskId/state', async (c) => {
  const authUser = requireAuthUser(c);
  const params = taskIdParamSchema.parse(c.req.param());
  const body = updateStateSchema.parse(await c.req.json());
  const state = await updateTaskUserState(params.taskId, authUser.userId, body);
  return c.json(state, 200);
});

tasksRouter.get('/:taskId/submissions', async (c) => {
  const authUser = requireAuthUser(c);
  const params = taskIdParamSchema.parse(c.req.param());
  const rows = await listTaskSubmissions(params.taskId, authUser.userId);
  return c.json(rows, 200);
});

tasksRouter.get('/:taskId/submissions/me', async (c) => {
  const authUser = requireAuthUser(c);
  const params = taskIdParamSchema.parse(c.req.param());
  const submission = await getMySubmission(params.taskId, authUser.userId);

  if (!submission) {
    return c.body(null, 204);
  }

  return c.json(submission, 200);
});

tasksRouter.put('/:taskId/submissions/me', async (c) => {
  const authUser = requireAuthUser(c);
  const params = taskIdParamSchema.parse(c.req.param());
  const body = upsertSubmissionBodySchema.parse(await c.req.json());
  const submission = await upsertMySubmissionContent(params.taskId, authUser.userId, body.content);
  return c.json(submission, 200);
});

tasksRouter.patch('/:taskId/submissions/:submissionId/grade', async (c) => {
  const authUser = requireAuthUser(c);
  const params = gradeParamSchema.parse(c.req.param());
  const body = gradeBodySchema.parse(await c.req.json());
  const submission = await gradeSubmission(params.taskId, params.submissionId, authUser.userId, body);
  return c.json(submission, 200);
});

tasksRouter.get('/:taskId/submissions/export', async (c) => {
  const authUser = requireAuthUser(c);
  const params = taskIdParamSchema.parse(c.req.param());
  const csv = await exportTaskSubmissionsCsv(params.taskId, authUser.userId);

  c.header('Content-Type', 'text/csv; charset=utf-8');
  c.header('Content-Disposition', `attachment; filename=task-${params.taskId}-submissions.csv`);

  return c.body(csv, 200);
});

tasksRouter.get('/:taskId/submissions/:submissionId', async (c) => {
  const authUser = requireAuthUser(c);
  const params = gradeParamSchema.parse(c.req.param());
  const submission = await getTaskSubmissionDetail(params.taskId, params.submissionId, authUser.userId);
  return c.json(submission, 200);
});

tasksRouter.post('/:taskId/attachments', async (c) => {
  const authUser = requireAuthUser(c);
  const params = taskIdParamSchema.parse(c.req.param());
  const formData = await c.req.formData();

  const records = await parseFilesFromFormData(formData, 'tasks', params.taskId);
  const attachments = await addTaskAttachments(params.taskId, authUser.userId, records);

  return c.json(attachments, 201);
});

tasksRouter.post('/:taskId/submissions/me/attachments', async (c) => {
  const authUser = requireAuthUser(c);
  const params = taskIdParamSchema.parse(c.req.param());
  const formData = await c.req.formData();
  const records = await parseFilesFromFormData(formData, 'submissions', authUser.userId);
  const attachments = await addSubmissionAttachments(params.taskId, authUser.userId, records);

  return c.json(attachments, 201);
});

tasksRouter.post('/:taskId/submissions/rename', async (c) => {
  const authUser = requireAuthUser(c);
  const params = taskIdParamSchema.parse(c.req.param());
  await renameTaskSubmissionAttachments(params.taskId, authUser.userId);
  return c.body(null, 204);
});
