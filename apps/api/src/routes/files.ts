import { Hono } from 'hono';
import { z } from 'zod';

import { requireAuthUser } from '../lib/context.js';
import { authMiddleware } from '../middleware/auth.js';
import { getAuthorizedFileUrl } from '../services/file.service.js';

import type { AppVariables } from '../types/context.js';

const fileParamSchema = z.object({
  fileKey: z.string().min(1),
});

export const filesRouter = new Hono<{ Variables: AppVariables }>();

filesRouter.use('*', authMiddleware);

filesRouter.get('/:fileKey{.+}', async (c) => {
  const authUser = requireAuthUser(c);
  const params = fileParamSchema.parse(c.req.param());
  const url = await getAuthorizedFileUrl(params.fileKey, authUser.userId);
  return c.redirect(url, 302);
});
