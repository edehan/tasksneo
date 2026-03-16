import { getAdminToken } from '../lib/env.js';
import { AppError } from '../lib/errors.js';

import type { MiddlewareHandler } from 'hono';
import type { AppVariables } from '../types/context.js';

export const adminMiddleware: MiddlewareHandler<{ Variables: AppVariables }> = async (c, next) => {
  const authHeader = c.req.header('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'Missing bearer token');
  }

  const token = authHeader.slice('Bearer '.length).trim();

  if (token !== getAdminToken()) {
    throw new AppError(403, 'FORBIDDEN', 'Invalid admin token');
  }

  c.set('isAdmin', true);
  await next();
};
