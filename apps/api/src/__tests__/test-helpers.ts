import fs from "node:fs";
import path from "node:path";
import { prisma } from "@taskflow/db";
import dotenv from "dotenv";

import {
	createUserWithPersonalClass,
	type RegisterInput,
	type SessionMetadata,
} from "../services/auth.service.js";

const repoRoot = path.resolve(process.cwd(), "../../");
const testEnvPath = path.join(repoRoot, ".env.test");
const fallbackEnvPath = path.join(repoRoot, ".env");

dotenv.config({
	path: fs.existsSync(testEnvPath) ? testEnvPath : fallbackEnvPath,
});

if (!process.env.ADMIN_TOKEN) {
	process.env.ADMIN_TOKEN = "test-admin-token";
}

if (!process.env.SYSTEM_CONFIG_SECRET) {
	process.env.SYSTEM_CONFIG_SECRET = "test-system-config-secret";
}

if (!process.env.NOTIFICATION_WORKER_ENABLED) {
	process.env.NOTIFICATION_WORKER_ENABLED = "false";
}

export async function resetDatabase() {
	await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'source_text'
      ) THEN
        ALTER TABLE tasks ADD COLUMN source_text TEXT;
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'is_published'
      ) THEN
        ALTER TABLE tasks ADD COLUMN is_published BOOLEAN NOT NULL DEFAULT true;
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'published_at'
      ) THEN
        ALTER TABLE tasks ADD COLUMN published_at TIMESTAMPTZ;
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'attachments' AND column_name = 'is_visible'
      ) THEN
        ALTER TABLE attachments ADD COLUMN is_visible BOOLEAN NOT NULL DEFAULT true;
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'classes' AND column_name = 'public_id'
      ) THEN
        ALTER TABLE classes ADD COLUMN public_id VARCHAR(8);
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'public_id'
      ) THEN
        ALTER TABLE tasks ADD COLUMN public_id VARCHAR(8);
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'submissions' AND column_name = 'public_id'
      ) THEN
        ALTER TABLE submissions ADD COLUMN public_id VARCHAR(8);
      END IF;
    END $$;
  `);

	await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS classes_public_id_key
      ON classes(public_id)
      WHERE public_id IS NOT NULL;
  `);

	await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS tasks_public_id_key
      ON tasks(public_id)
      WHERE public_id IS NOT NULL;
  `);

	await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS submissions_public_id_key
      ON submissions(public_id)
      WHERE public_id IS NOT NULL;
  `);

	await prisma.$executeRawUnsafe(`
    UPDATE tasks
    SET published_at = created_at
    WHERE is_published = true AND published_at IS NULL;
  `);

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
      sessions,
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
	app: {
		request: (
			input: string,
			init?: RequestInit,
		) => Response | Promise<Response>;
	},
	url: string,
	init?: RequestInit,
) {
	const response = await Promise.resolve(
		app.request(url, {
			...init,
			headers: {
				"Content-Type": "application/json",
				...(init?.headers ?? {}),
			},
		}),
	);

	return {
		response,
		body: await json(response),
	};
}

/**
 * Creates a user, personal class, credential, and browser session directly
 * via the auth service — bypassing the two-step email verification flow
 * that the live `/auth/register` route uses. Returns the same
 * `{ token, user }` shape as `/auth/register/complete` so tests can treat
 * this like a registration result.
 */
export async function createTestUser(
	input: Partial<RegisterInput> & { emailPrefix?: string } = {},
	sessionOverrides: Partial<SessionMetadata> = {},
) {
	const meta: SessionMetadata = {
		trustDevice: false,
		userAgent: "vitest",
		ipAddress: "127.0.0.1",
		...sessionOverrides,
	};

	const result = await createUserWithPersonalClass(
		{
			email: input.email ?? uniqueEmail(input.emailPrefix ?? "user"),
			password: input.password ?? "Passw0rd!",
			nickname: input.nickname ?? null,
			schoolId: input.schoolId ?? null,
			studentId: input.studentId ?? null,
			timezone: input.timezone,
		},
		meta,
	);

	return result;
}

export async function requestAny(
	app: {
		request: (
			input: string,
			init?: RequestInit,
		) => Response | Promise<Response>;
	},
	url: string,
	init?: RequestInit,
) {
	return Promise.resolve(
		app.request(url, {
			...init,
		}),
	);
}
