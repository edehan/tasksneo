import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { errorHandler } from './middleware/error.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { classesRouter } from './routes/classes.js';
import { filesRouter } from './routes/files.js';
import { schoolsRouter } from './routes/schools.js';
import { tasksRouter } from './routes/tasks.js';
import { usersRouter } from './routes/users.js';
import { startNotificationWorker } from './services/notification.service.js';

import type { AppVariables } from './types/context.js';

const ALLOWED_WEB_ORIGINS = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:35540',
  'http://127.0.0.1:35540',
]);

export function createApp(options?: { startWorker?: boolean }) {
  const app = new Hono<{ Variables: AppVariables }>();

  app.onError(errorHandler);
  app.use(
    '*',
    cors({
      origin: (origin) => {
        if (!origin || ALLOWED_WEB_ORIGINS.has(origin)) {
          return origin;
        }

        return '';
      },
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );

  app.get('/health', (c) => c.json({ status: 'ok' }, 200));
  app.route('/auth', authRouter);
  app.route('/users', usersRouter);
  app.route('/schools', schoolsRouter);
  app.route('/classes', classesRouter);
  app.route('/tasks', tasksRouter);
  app.route('/files', filesRouter);
  app.route('/admin', adminRouter);

  if (options?.startWorker) {
    startNotificationWorker();
  }

  return app;
}

export const app = createApp({ startWorker: process.env.NOTIFICATION_WORKER_ENABLED === 'true' });
