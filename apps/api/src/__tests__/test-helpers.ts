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

if (!process.env.AUDIT_LOG_HMAC_SECRET) {
	process.env.AUDIT_LOG_HMAC_SECRET = "test-audit-log-hmac-secret";
}

if (!process.env.NOTIFICATION_WORKER_ENABLED) {
	process.env.NOTIFICATION_WORKER_ENABLED = "false";
}

export async function resetDatabase() {
	await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_actor_type') THEN
        CREATE TYPE audit_actor_type AS ENUM ('USER', 'ADMIN', 'SYSTEM');
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.sequences
        WHERE sequence_name = 'audit_logs_sequence_seq'
      ) THEN
        CREATE SEQUENCE audit_logs_sequence_seq;
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'audit_logs'
      ) THEN
        CREATE TABLE audit_logs (
          id TEXT NOT NULL,
          sequence BIGINT NOT NULL DEFAULT nextval('audit_logs_sequence_seq'),
          action VARCHAR(100) NOT NULL,
          actor_type audit_actor_type NOT NULL,
          actor_user_id TEXT,
          target_type VARCHAR(100),
          target_id TEXT,
          class_id TEXT,
          metadata JSONB,
          ip_address VARCHAR(45),
          user_agent VARCHAR(512),
          request_id VARCHAR(128),
          prev_hash CHAR(64),
          entry_hash CHAR(64) NOT NULL,
          hash_algorithm VARCHAR(32) NOT NULL DEFAULT 'HMAC-SHA256',
          hash_key_id VARCHAR(100) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
          CONSTRAINT audit_logs_sequence_key UNIQUE (sequence)
        );
        ALTER SEQUENCE audit_logs_sequence_seq OWNED BY audit_logs.sequence;
        CREATE INDEX idx_audit_logs_created ON audit_logs (created_at DESC);
        CREATE INDEX idx_audit_logs_action_created ON audit_logs (action, created_at DESC);
        CREATE INDEX idx_audit_logs_actor_created ON audit_logs (actor_user_id, created_at DESC);
        CREATE INDEX idx_audit_logs_target ON audit_logs (target_type, target_id);
        CREATE INDEX idx_audit_logs_class_created ON audit_logs (class_id, created_at DESC);
      END IF;

      CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
      RETURNS trigger AS $fn$
      BEGIN
        RAISE EXCEPTION 'audit_logs is append-only';
      END;
      $fn$ LANGUAGE plpgsql;

      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_logs_no_update'
      ) THEN
        CREATE TRIGGER trg_audit_logs_no_update
        BEFORE UPDATE ON audit_logs
        FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_logs_no_delete'
      ) THEN
        CREATE TRIGGER trg_audit_logs_no_delete
        BEFORE DELETE ON audit_logs
        FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'locale'
      ) THEN
        ALTER TABLE users ADD COLUMN locale VARCHAR(16) NOT NULL DEFAULT 'en';
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_locale_check'
      ) THEN
        ALTER TABLE users
          ADD CONSTRAINT users_locale_check
          CHECK (locale IN ('en', 'zh-CN', 'fr', 'ja'));
      END IF;

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
    END $$;
  `);

	await prisma.$executeRawUnsafe(`
    UPDATE tasks
    SET published_at = created_at
    WHERE is_published = true AND published_at IS NULL;
  `);

	await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      audit_logs,
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
    RESTART IDENTITY CASCADE;
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
			locale: input.locale,
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
