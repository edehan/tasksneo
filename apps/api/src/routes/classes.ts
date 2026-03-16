import { Hono } from 'hono';
import { z } from 'zod';

import { authMiddleware } from '../middleware/auth.js';
import {
  createClass,
  getClassDetail,
  joinClass,
  listClassMembers,
  listMyClasses,
} from '../services/class.service.js';

import type { AppVariables } from '../types/context.js';

const classIdParamSchema = z.object({
  classId: z.string().uuid(),
});

const createClassBodySchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  schoolId: z.string().uuid().optional().nullable(),
});

const joinClassBodySchema = z.object({
  inviteCode: z.string().trim().min(1),
});

export const classesRouter = new Hono<{ Variables: AppVariables }>();

classesRouter.use('*', authMiddleware);

classesRouter.get('/', async (c) => {
  const authUser = c.get('authUser');
  const classes = await listMyClasses(authUser.userId);
  return c.json(classes, 200);
});

classesRouter.post('/', async (c) => {
  const authUser = c.get('authUser');
  const body = createClassBodySchema.parse(await c.req.json());
  const createdClass = await createClass(authUser.userId, body);
  return c.json(createdClass, 201);
});

classesRouter.post('/join', async (c) => {
  const authUser = c.get('authUser');
  const body = joinClassBodySchema.parse(await c.req.json());
  const joinedClass = await joinClass(authUser.userId, body.inviteCode);
  return c.json(joinedClass, 200);
});

classesRouter.get('/:classId', async (c) => {
  const authUser = c.get('authUser');
  const params = classIdParamSchema.parse(c.req.param());
  const classInfo = await getClassDetail(params.classId, authUser.userId);
  return c.json(classInfo, 200);
});

classesRouter.get('/:classId/members', async (c) => {
  const authUser = c.get('authUser');
  const params = classIdParamSchema.parse(c.req.param());
  const members = await listClassMembers(params.classId, authUser.userId);
  return c.json(members, 200);
});
