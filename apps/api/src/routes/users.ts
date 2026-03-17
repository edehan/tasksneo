import { NotifChannel } from '@taskflow/db';
import { Hono } from 'hono';
import { z } from 'zod';

import { requireAuthUser } from '../lib/context.js';
import { uploadObject } from '../lib/storage.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  deleteMyAccount,
  getMyProfile,
  listMyNotificationPrefs,
  updateMyPassword,
  updateMyProfile,
  uploadMyAvatar,
  upsertMyNotificationPref,
} from '../services/user.service.js';

import type { AppVariables } from '../types/context.js';
import type { MiddlewareHandler } from 'hono';

const updateProfileSchema = z.object({
  nickname: z.string().optional().nullable(),
  schoolId: z.string().uuid().optional().nullable(),
  studentId: z.string().optional().nullable(),
  timezone: z.string().max(64).optional(),
});

const updatePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});

const upsertNotificationSchema = z.object({
  channel: z.enum([NotifChannel.EMAIL, NotifChannel.WEBHOOK, NotifChannel.TELEGRAM]),
  address: z.string().min(1),
  isEnabled: z.boolean().optional(),
});

export const usersRouter = new Hono<{ Variables: AppVariables }>();

usersRouter.use('*', authMiddleware);

usersRouter.get('/me', async (c) => {
  const authUser = requireAuthUser(c);
  const user = await getMyProfile(authUser.userId);
  return c.json(user, 200);
});

usersRouter.patch('/me', async (c) => {
  const authUser = requireAuthUser(c);
  const body = updateProfileSchema.parse(await c.req.json());
  const user = await updateMyProfile(authUser.userId, body);
  return c.json(user, 200);
});

usersRouter.patch('/me/password', async (c) => {
  const authUser = requireAuthUser(c);
  const body = updatePasswordSchema.parse(await c.req.json());
  await updateMyPassword(authUser.userId, body.currentPassword, body.newPassword);
  return c.body(null, 204);
});

usersRouter.get('/me/notification-prefs', async (c) => {
  const authUser = requireAuthUser(c);
  const prefs = await listMyNotificationPrefs(authUser.userId);
  return c.json(prefs, 200);
});

const upsertNotificationHandler: MiddlewareHandler<{ Variables: AppVariables }> = async (c) => {
  const authUser = requireAuthUser(c);
  const body = upsertNotificationSchema.parse(await c.req.json());
  const pref = await upsertMyNotificationPref(authUser.userId, body);
  return c.json(pref, 200);
};

usersRouter.put('/me/notification-prefs', upsertNotificationHandler);
usersRouter.post('/me/notification-prefs', upsertNotificationHandler);

usersRouter.post('/me/delete', async (c) => {
  const authUser = requireAuthUser(c);
  await deleteMyAccount(authUser.userId);
  return c.body(null, 204);
});

usersRouter.post('/me/avatar', async (c) => {
  const authUser = requireAuthUser(c);
  const formData = await c.req.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return c.json({ error: 'file is required', code: 'VALIDATION_ERROR' }, 400);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const fileKey = await uploadObject('avatars', authUser.userId, file.name, bytes, file.type || undefined);

  const attachment = await uploadMyAvatar(authUser.userId, {
    fileKey,
    originalName: file.name,
    mimeType: file.type || null,
    sizeBytes: BigInt(bytes.byteLength),
  });

  return c.json(attachment, 200);
});
