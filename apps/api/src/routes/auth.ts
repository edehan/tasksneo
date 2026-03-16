import { Hono } from 'hono';
import { z } from 'zod';

import { login, register } from '../services/auth.service.js';

const registerBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  nickname: z.string().optional().nullable(),
  schoolId: z.string().uuid().optional().nullable(),
  studentId: z.string().optional().nullable(),
});

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const authRouter = new Hono();

authRouter.post('/register', async (c) => {
  const body = registerBodySchema.parse(await c.req.json());
  const result = await register(body);
  return c.json(result, 201);
});

authRouter.post('/login', async (c) => {
  const body = loginBodySchema.parse(await c.req.json());
  const result = await login(body);
  return c.json(result, 200);
});
