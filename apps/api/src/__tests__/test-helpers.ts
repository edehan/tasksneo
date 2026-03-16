import dotenv from 'dotenv';
import path from 'node:path';

import { prisma } from '@taskflow/db';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret';
}

if (!process.env.ADMIN_TOKEN) {
  process.env.ADMIN_TOKEN = 'test-admin-token';
}

if (!process.env.NOTIFICATION_WORKER_ENABLED) {
  process.env.NOTIFICATION_WORKER_ENABLED = 'false';
}

export async function resetDatabase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      notification_jobs,
      attachments,
      submissions,
      task_user_state,
      tasks,
      class_members,
      classes,
      user_notification_prefs,
      user_credentials,
      users,
      schools,
      system_config
    CASCADE;
  `);
}

export function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 100000)}@example.com`;
}

export async function json(response: Response) {
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function requestJson(
  app: { request: (input: string, init?: RequestInit) => Response | Promise<Response> },
  url: string,
  init?: RequestInit,
) {
  const response = await Promise.resolve(
    app.request(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    }),
  );

  return {
    response,
    body: await json(response),
  };
}

export async function requestAny(
  app: { request: (input: string, init?: RequestInit) => Response | Promise<Response> },
  url: string,
  init?: RequestInit,
) {
  return Promise.resolve(
    app.request(url, {
      ...init,
    }),
  );
}
