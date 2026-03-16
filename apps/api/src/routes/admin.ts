import { Hono } from 'hono';
import { z } from 'zod';

import { adminMiddleware } from '../middleware/admin.js';
import {
  createAdminSchool,
  deleteAdminSchool,
  deleteAdminUser,
  getAdminConfig,
  listAdminSchools,
  listAdminUsers,
  patchAdminConfig,
  updateAdminUser,
} from '../services/admin.service.js';

import type { AppVariables } from '../types/context.js';

const userIdParamSchema = z.object({
  userId: z.string().uuid(),
});

const schoolIdParamSchema = z.object({
  schoolId: z.string().uuid(),
});

const patchConfigSchema = z.record(z.string(), z.string());

const patchAdminUserSchema = z.object({
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

const createSchoolSchema = z.object({
  name: z.string().trim().min(1),
});

export const adminRouter = new Hono<{ Variables: AppVariables }>();

adminRouter.use('*', adminMiddleware);

adminRouter.get('/config', async (c) => {
  const config = await getAdminConfig();
  return c.json(config, 200);
});

adminRouter.patch('/config', async (c) => {
  const body = patchConfigSchema.parse(await c.req.json());
  const config = await patchAdminConfig(body);
  return c.json(config, 200);
});

adminRouter.get('/users', async (c) => {
  const users = await listAdminUsers();
  return c.json(users, 200);
});

adminRouter.patch('/users/:userId', async (c) => {
  const params = userIdParamSchema.parse(c.req.param());
  const body = patchAdminUserSchema.parse(await c.req.json());
  const user = await updateAdminUser(params.userId, body);
  return c.json(user, 200);
});

adminRouter.delete('/users/:userId', async (c) => {
  const params = userIdParamSchema.parse(c.req.param());
  await deleteAdminUser(params.userId);
  return c.body(null, 204);
});

adminRouter.get('/schools', async (c) => {
  const schools = await listAdminSchools();
  return c.json(schools, 200);
});

adminRouter.post('/schools', async (c) => {
  const body = createSchoolSchema.parse(await c.req.json());
  const school = await createAdminSchool(body.name);
  return c.json(school, 201);
});

adminRouter.delete('/schools/:schoolId', async (c) => {
  const params = schoolIdParamSchema.parse(c.req.param());
  await deleteAdminSchool(params.schoolId);
  return c.body(null, 204);
});
