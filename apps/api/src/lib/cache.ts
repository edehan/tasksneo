import type { Redis } from "ioredis";

import { getRedisClient } from "./redis.js";

// Sentinel stored in Redis to remember "this key had no value" so that
// repeated misses don't keep hitting the DB (e.g. unauthorized access probes).
const NULL_SENTINEL = "__null__";

// Per-process hit/miss counters for observability. Exposed via getCacheStats().
const stats = {
	hit: 0,
	miss: 0,
	error: 0,
};

// Rate-limit "redis is down" log noise to once per minute.
let lastErrorLogAt = 0;
function logError(op: string, err: unknown) {
	stats.error += 1;
	const now = Date.now();
	if (now - lastErrorLogAt > 60_000) {
		lastErrorLogAt = now;
		// eslint-disable-next-line no-console
		console.warn(`[cache] ${op} failed:`, err);
	}
}

function safeClient(): Redis | null {
	try {
		return getRedisClient();
	} catch (err) {
		logError("connect", err);
		return null;
	}
}

export async function cacheGet<T>(key: string): Promise<T | null> {
	const client = safeClient();
	if (!client) return null;
	try {
		const raw = await client.get(key);
		if (raw === null) {
			stats.miss += 1;
			return null;
		}
		if (raw === NULL_SENTINEL) {
			stats.hit += 1;
			return null;
		}
		stats.hit += 1;
		return JSON.parse(raw) as T;
	} catch (err) {
		logError("get", err);
		return null;
	}
}

export async function cacheSet<T>(
	key: string,
	value: T,
	ttlSeconds: number,
): Promise<void> {
	const client = safeClient();
	if (!client) return;
	try {
		const serialized = value === null ? NULL_SENTINEL : JSON.stringify(value);
		await client.set(key, serialized, "EX", ttlSeconds);
	} catch (err) {
		logError("set", err);
	}
}

export async function cacheDel(...keys: string[]): Promise<void> {
	if (keys.length === 0) return;
	const client = safeClient();
	if (!client) return;
	try {
		await client.del(...keys);
	} catch (err) {
		logError("del", err);
	}
}

/**
 * Cache-aside loader. On a miss, runs `loader`, caches the result (including
 * `null`) and returns it. On Redis failure, transparently falls through to
 * `loader` so the request still succeeds.
 */
export async function cacheGetOrSet<T>(
	key: string,
	ttlSeconds: number,
	loader: () => Promise<T>,
): Promise<T> {
	const client = safeClient();
	if (!client) {
		return loader();
	}

	let raw: string | null = null;
	try {
		raw = await client.get(key);
	} catch (err) {
		logError("get", err);
		return loader();
	}

	if (raw !== null) {
		stats.hit += 1;
		if (raw === NULL_SENTINEL) {
			return null as T;
		}
		try {
			return JSON.parse(raw) as T;
		} catch (err) {
			// Corrupt entry; fall through to reload.
			logError("parse", err);
		}
	} else {
		stats.miss += 1;
	}

	const value = await loader();
	try {
		const serialized = value === null ? NULL_SENTINEL : JSON.stringify(value);
		await client.set(key, serialized, "EX", ttlSeconds);
	} catch (err) {
		logError("set", err);
	}
	return value;
}

/**
 * Delete all keys matching the given pattern. Uses SCAN + pipelined DEL so it
 * doesn't block Redis. Intended for bulk invalidation (e.g. a whole class's
 * membership entries). Call sparingly.
 */
export async function cacheDelPattern(pattern: string): Promise<void> {
	const client = safeClient();
	if (!client) return;
	try {
		let cursor = "0";
		do {
			const [nextCursor, keys] = await client.scan(
				cursor,
				"MATCH",
				pattern,
				"COUNT",
				100,
			);
			cursor = nextCursor;
			if (keys.length > 0) {
				const pipeline = client.pipeline();
				for (const k of keys) pipeline.del(k);
				await pipeline.exec();
			}
		} while (cursor !== "0");
	} catch (err) {
		logError("delPattern", err);
	}
}

// ── Key builders ───────────────────────────────────────────────────────────
// Centralized so invalidation sites can't typo a key.

export const cacheKeys = {
	session: (tokenHash: string) => `session:${tokenHash}`,
	membership: (classId: string, userId: string) =>
		`member:${classId}:${userId}`,
	membershipClassPattern: (classId: string) => `member:${classId}:*`,
	notifPrefs: (userId: string) => `notifPrefs:${userId}`,
	taskStats: (taskId: string) => `task:stats:${taskId}`,
	classDetail: (classId: string) => `class:${classId}`,
};

export function getCacheStats() {
	return { ...stats };
}

export function resetCacheStats() {
	stats.hit = 0;
	stats.miss = 0;
	stats.error = 0;
}
