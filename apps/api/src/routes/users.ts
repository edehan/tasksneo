import { Hono } from 'hono';

import { authMiddleware } from '../middleware/auth.js';
import { getMyProfile } from '../services/user.service.js';

import type { AppVariables } from '../types/context.js';

export const usersRouter = new Hono<{ Variables: AppVariables }>();

usersRouter.get('/me', authMiddleware, async (c) => {
  const authUser = c.get('authUser');
  const user = await getMyProfile(authUser.userId);
  return c.json(user, 200);
});
