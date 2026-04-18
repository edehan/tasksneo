import { createHash, randomBytes } from "node:crypto";
import { prisma, SessionKind } from "@taskflow/db";

import { lookupCountry } from "../lib/ip-geo.js";
import {
	processSessionCleanupQueue,
	scheduleSessionCleanupCron,
} from "../lib/queue.js";

// ── Constants ───────────────────────────────────────────────────────────────

const SESSION_TOKEN_PREFIX = "tfses_";
const TOUCH_DEBOUNCE_MS = 60 * 60 * 1000; // 1 hour
const UNTRUSTED_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, hard cap
const TRUSTED_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, sliding

// ── Types ───────────────────────────────────────────────────────────────────

export interface CreateBrowserSessionInput {
	userId: string;
	isTrusted: boolean;
	userAgent: string | null;
	ipAddress: string | null;
}

export interface CreateMcpSessionInput {
	userId: string;
	mcpKeyId: string;
	expiresAt: Date | null;
	userAgent: string | null;
	ipAddress: string | null;
}

export interface CachedSession {
	id: string;
	userId: string;
	email: string;
	isActive: boolean;
	kind: SessionKind;
	mcpKeyId: string | null;
	isTrusted: boolean;
	lastSeenAt: string; // ISO
	expiresAt: string | null; // ISO — null means never expires (MCP only)
}

// ── Token helpers ───────────────────────────────────────────────────────────

function generateSessionToken(): { raw: string; hash: string } {
	const bytes = randomBytes(32);
	const raw = `${SESSION_TOKEN_PREFIX}${bytes.toString("base64url")}`;
	const hash = createHash("sha256").update(raw).digest("hex");
	return { raw, hash };
}

export function hashSessionToken(raw: string): string {
	return createHash("sha256").update(raw).digest("hex");
}

export function isSessionToken(raw: string): boolean {
	return raw.startsWith(SESSION_TOKEN_PREFIX);
}

// ── Creation ────────────────────────────────────────────────────────────────

export async function createBrowserSession(input: CreateBrowserSessionInput) {
	const { raw, hash } = generateSessionToken();
	const now = new Date();
	const expiresAt = new Date(
		now.getTime() + (input.isTrusted ? TRUSTED_TTL_MS : UNTRUSTED_TTL_MS),
	);

	const session = await prisma.session.create({
		data: {
			userId: input.userId,
			tokenHash: hash,
			kind: SessionKind.BROWSER,
			isTrusted: input.isTrusted,
			userAgent: input.userAgent?.slice(0, 512) ?? null,
			ipAddress: input.ipAddress?.slice(0, 45) ?? null,
			expiresAt,
		},
	});

	return { session, token: raw };
}

export async function createMcpSession(input: CreateMcpSessionInput) {
	const { raw, hash } = generateSessionToken();

	const session = await prisma.session.create({
		data: {
			userId: input.userId,
			tokenHash: hash,
			kind: SessionKind.MCP,
			mcpKeyId: input.mcpKeyId,
			isTrusted: false,
			userAgent: input.userAgent?.slice(0, 512) ?? null,
			ipAddress: input.ipAddress?.slice(0, 45) ?? null,
			expiresAt: input.expiresAt,
		},
	});

	return { session, token: raw };
}

// ── Lookup ─────────────────────────────────────────────────────────────────

/**
 * Load a session by raw token directly from DB. This makes the database the
 * source of truth for revocation so deleting a session invalidates it
 * immediately without relying on cache invalidation succeeding.
 */
export async function loadSessionByToken(
	rawToken: string,
): Promise<CachedSession | null> {
	const hash = hashSessionToken(rawToken);

	const row = await prisma.session.findUnique({
		where: { tokenHash: hash },
		include: {
			user: {
				select: { id: true, email: true, isActive: true },
			},
		},
	});

	if (!row) {
		return null;
	}

	if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
		return null;
	}

	return {
		id: row.id,
		userId: row.userId,
		email: row.user.email,
		isActive: row.user.isActive,
		kind: row.kind,
		mcpKeyId: row.mcpKeyId,
		isTrusted: row.isTrusted,
		lastSeenAt: row.lastSeenAt.toISOString(),
		expiresAt: row.expiresAt?.toISOString() ?? null,
	};
}

// ── Touch (debounced lastSeenAt + sliding expiresAt) ─────────────────────────

/**
 * Update lastSeenAt if more than 1h has passed since the last touch. For
 * trusted BROWSER sessions, extends expiresAt to now + 30d in the same UPDATE.
 *
 * MCP sessions: never touched here. Their lifetime follows McpKey.expiresAt.
 * Untrusted BROWSER: only lastSeenAt is updated, expiresAt stays fixed.
 *
 * Debouncing is based on the DB-backed lastSeenAt we loaded for this request,
 * so revocation remains correct even if Redis is unavailable.
 */
export async function touchSession(
	session: CachedSession,
): Promise<CachedSession> {
	if (session.kind === SessionKind.MCP) {
		return session;
	}

	const now = Date.now();
	const lastSeen = new Date(session.lastSeenAt).getTime();

	if (now - lastSeen < TOUCH_DEBOUNCE_MS) {
		return session;
	}

	const nextExpiresAt = session.isTrusted
		? new Date(now + TRUSTED_TTL_MS)
		: undefined;

	const updated = await prisma.session.update({
		where: { id: session.id },
		data: {
			lastSeenAt: new Date(now),
			...(nextExpiresAt ? { expiresAt: nextExpiresAt } : {}),
		},
	});

	return {
		...session,
		lastSeenAt: updated.lastSeenAt.toISOString(),
		expiresAt: updated.expiresAt?.toISOString() ?? session.expiresAt,
	};
}

// ── Revocation ──────────────────────────────────────────────────────────────

export async function revokeSession(sessionId: string): Promise<void> {
	await prisma.session
		.delete({ where: { id: sessionId } })
		.catch(() => undefined);
}

/**
 * Revoke all BROWSER sessions for a user. Optionally keep one session alive
 * (used by the "change password" flow to avoid kicking the current browser).
 * MCP sessions are NOT touched — they're managed via the mcp_keys table.
 */
export async function revokeAllBrowserSessions(
	userId: string,
	exceptSessionId?: string,
): Promise<void> {
	await prisma.session.deleteMany({
		where: {
			userId,
			kind: SessionKind.BROWSER,
			...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
		},
	});
}

/**
 * Delete all sessions tied to a specific MCP key. Called when an MCP key is
 * revoked so existing MCP session tokens stop working immediately.
 */
export async function revokeMcpSessionsByKeyId(
	mcpKeyId: string,
): Promise<void> {
	await prisma.session.deleteMany({ where: { mcpKeyId } });
}

// ── Listing ─────────────────────────────────────────────────────────────────

export interface SessionListItem {
	id: string;
	kind: SessionKind;
	isTrusted: boolean;
	isCurrent: boolean;
	userAgent: string | null;
	ipAddress: string | null;
	country: string | null;
	mcpKeyId: string | null;
	mcpKeyName: string | null;
	createdAt: string;
	lastSeenAt: string;
	expiresAt: string | null;
}

export async function listUserSessions(
	userId: string,
	currentSessionId: string,
): Promise<SessionListItem[]> {
	const rows = await prisma.session.findMany({
		where: { userId },
		include: { mcpKey: { select: { id: true, name: true } } },
		orderBy: { lastSeenAt: "desc" },
	});

	return rows.map((r) => ({
		id: r.id,
		kind: r.kind,
		isTrusted: r.isTrusted,
		isCurrent: r.id === currentSessionId,
		userAgent: r.userAgent,
		ipAddress: r.ipAddress,
		country: lookupCountry(r.ipAddress),
		mcpKeyId: r.mcpKeyId,
		mcpKeyName: r.mcpKey?.name ?? null,
		createdAt: r.createdAt.toISOString(),
		lastSeenAt: r.lastSeenAt.toISOString(),
		expiresAt: r.expiresAt?.toISOString() ?? null,
	}));
}

// ── Cleanup ─────────────────────────────────────────────────────────────────

/**
 * Bulk delete expired sessions. Called by the daily cleanup cron.
 * Returns the number of rows deleted for logging.
 */
export async function deleteExpiredSessions(): Promise<number> {
	const result = await prisma.session.deleteMany({
		where: { expiresAt: { lt: new Date() } },
	});
	return result.count;
}

/**
 * Wire up the daily cleanup cron: register the Bull processor and schedule
 * the repeatable job. Called once at startup from app.ts.
 */
export async function startSessionCleanupWorker() {
	processSessionCleanupQueue(async () => {
		const deleted = await deleteExpiredSessions();
		if (deleted > 0) {
			console.log(`[session-cleanup] deleted ${deleted} expired sessions`);
		}
	});

	await scheduleSessionCleanupCron();
}
