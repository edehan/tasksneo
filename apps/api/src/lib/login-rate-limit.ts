import { createHash } from "node:crypto";

import { AppError } from "./errors.js";
import { rootLogger } from "./logger.js";
import { getRedisClient } from "./redis.js";

const LOGIN_FAILURE_WINDOW_SECONDS = 15 * 60;
const LOGIN_FAILURE_MAX = 50;

function keyForIp(ipAddress: string | null): string | null {
	if (!ipAddress) return null;
	const digest = createHash("sha256").update(ipAddress).digest("hex");
	return `rate:login-fail:${digest}`;
}

async function getFailureCount(key: string): Promise<number> {
	const client = getRedisClient();
	const raw = await client.get(key);
	const count = raw === null ? 0 : Number(raw);
	return Number.isFinite(count) ? count : 0;
}

function throwRateLimited(): never {
	throw new AppError(
		429,
		"LOGIN_RATE_LIMITED",
		"Too many failed login attempts. Please try again later.",
	);
}

function logRateLimitError(operation: string, error: unknown) {
	rootLogger.warn({ err: error, operation }, "login_rate_limit_failed");
}

export async function assertLoginAllowed(ipAddress: string | null) {
	const key = keyForIp(ipAddress);
	if (!key) return;

	try {
		const count = await getFailureCount(key);
		if (count >= LOGIN_FAILURE_MAX) {
			throwRateLimited();
		}
	} catch (error) {
		if (error instanceof AppError) throw error;
		logRateLimitError("assert", error);
	}
}

export async function recordFailedLoginAttempt(ipAddress: string | null) {
	const key = keyForIp(ipAddress);
	if (!key) return;

	try {
		const client = getRedisClient();
		const initialized = await client.set(
			key,
			"1",
			"EX",
			LOGIN_FAILURE_WINDOW_SECONDS,
			"NX",
		);
		const count = initialized === "OK" ? 1 : await client.incr(key);

		if (count >= LOGIN_FAILURE_MAX) {
			throwRateLimited();
		}
	} catch (error) {
		if (error instanceof AppError) throw error;
		logRateLimitError("record", error);
	}
}
