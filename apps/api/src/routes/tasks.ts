import { Hono } from 'hono';
import { z } from 'zod';

import { AppError } from '../lib/errors.js';
import { requireAuthUser } from '../lib/context.js';
import { uploadObject } from '../lib/storage.js';
import { authMiddleware } from '../middleware/auth.js';
import { parseTaskDescription } from '../services/ai.service.js';
import {
  addTaskAttachments,
  deleteTask,
  exportTaskSubmissionsCsv,
  getMySubmission,
  getTaskDetail,
  gradeSubmission,
  listTaskSubmissions,
  markTaskViewed,
  renameTaskSubmissionAttachments,
  updateTask,
  updateTaskUserState,
  upsertMySubmission,
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
  startAt: z.string().datetime().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  allowLateSubmission: z.boolean().optional(),
  blockedBy: z.array(z.string().uuid()).optional(),
});

const updateStateSchema = z.object({
  tags: z.array(z.string()).optional(),
  sortOrder: z.number().optional(),
});

const gradeBodySchema = z.object({
  score: z.string().optional().nullable(),
  reviewNote: z.string().optional().nullable(),
});

async function parseFilesFromFormData(formData: FormData, parentType: string, parentId: string) {
  const rawFiles = formData.getAll('files');

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

tasksRouter.post('/parse', async (c) => {
  const body = parseSchema.parse(await c.req.json());
  const result = await parseTaskDescription(body.text);
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
  const submission = await upsertMySubmission(params.taskId, authUser.userId, records);

  return c.json(submission, 200);
});

tasksRouter.post('/:taskId/submissions/rename', async (c) => {
  const authUser = requireAuthUser(c);
  const params = taskIdParamSchema.parse(c.req.param());
  await renameTaskSubmissionAttachments(params.taskId, authUser.userId);
  return c.body(null, 204);
});
