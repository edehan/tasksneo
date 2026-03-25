import { Hono } from 'hono';
import { z } from 'zod';

import { requireAuthUser } from '../lib/context.js';
import { authMiddleware } from '../middleware/auth.js';
import { getSubmissionById } from '../services/task.service.js';

import type { AppVariables } from '../types/context.js';

const submissionIdParamSchema = z.object({
  submissionId: z.string().uuid(),
});

export const submissionsRouter = new Hono<{ Variables: AppVariables }>();

submissionsRouter.use('*', authMiddleware);

submissionsRouter.get('/:submissionId', async (c) => {
  const authUser = requireAuthUser(c);
  const params = submissionIdParamSchema.parse(c.req.param());
  const submission = await getSubmissionById(params.submissionId, authUser.userId);
  return c.json(submission, 200);
});
