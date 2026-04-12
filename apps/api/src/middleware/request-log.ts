import { randomUUID } from "node:crypto";

import type { MiddlewareHandler } from "hono";

import { rootLogger } from "../lib/logger.js";
import type { AppVariables } from "../types/context.js";

const INCOMING_ID_MAX_LEN = 128;
const INCOMING_ID_RE = /^[A-Za-z0-9._-]+$/;

function normalizeRequestId(incoming: string | undefined): string {
	if (
		incoming &&
		incoming.length > 0 &&
		incoming.length <= INCOMING_ID_MAX_LEN &&
		INCOMING_ID_RE.test(incoming)
	) {
		return incoming;
	}
	return randomUUID();
}

export const requestLogMiddleware: MiddlewareHandler<{
	Variables: AppVariables;
}> = async (c, next) => {
	const requestId = normalizeRequestId(c.req.header("x-request-id"));
	const logger = rootLogger.child({ requestId });
	c.set("requestId", requestId);
	c.set("logger", logger);
	c.header("x-request-id", requestId);

	const start = performance.now();
	try {
		await next();
	} finally {
		const duration_ms = Math.round(performance.now() - start);
		const status = c.res?.status ?? 500;
		const route = c.req.routePath || c.req.path;
		const userId = c.get("authUser")?.userId;
		const ip =
			c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
			c.req.header("x-real-ip") ||
			undefined;

		const fields = {
			method: c.req.method,
			path: c.req.path,
			route,
			status,
			duration_ms,
			userId,
			ip,
			ua: c.req.header("user-agent"),
		};

		if (status >= 500) {
			logger.error(fields, "request");
		} else if (status >= 400) {
			logger.warn(fields, "request");
		} else {
			logger.info(fields, "request");
		}
	}
};
