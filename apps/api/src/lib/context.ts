import { AppError } from './errors.js';

import type { Context } from 'hono';
import type { AppVariables, AuthUser } from '../types/context.js';

export function requireAuthUser(c: Context<{ Variables: AppVariables }>): AuthUser {
  const user = c.get('authUser');

  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Missing auth context');
  }

  return user;
}
