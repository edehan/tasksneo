import { serve } from '@hono/node-server';
import { Hono } from 'hono';

import { loadEnv } from './lib/env.js';
import { errorHandler } from './middleware/error.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';

import type { AppVariables } from './types/context.js';

const env = loadEnv();

const app = new Hono<{ Variables: AppVariables }>();

app.onError(errorHandler);

app.get('/health', (c) => c.json({ status: 'ok' }, 200));
app.route('/auth', authRouter);
app.route('/users', usersRouter);

serve(
  {
    fetch: app.fetch,
    hostname: env.listenHost,
    port: env.listenPort,
  },
  (info) => {
    console.log(`TaskFlow API listening on http://${info.address}:${info.port}`);
  },
);
