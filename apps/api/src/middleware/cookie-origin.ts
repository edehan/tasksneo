import type { MiddlewareHandler } from "hono";

import { readSessionCookie } from "../lib/cookie.js";
import { AppError } from "../lib/errors.js";
import { isAllowedWebOrigin } from "../lib/web-origin.js";
import type { AppVariables } from "../types/context.js";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF guard for cookie-authenticated browser writes.
 * Bearer-authenticated clients (MCP/admin/scripts) are not subject to this
 * check and continue to use token-based auth semantics.
 */
export const cookieOriginMiddleware: MiddlewareHandler<{
	Variables: AppVariables;
}> = async (c, next) => {
	if (!WRITE_METHODS.has(c.req.method.toUpperCase())) {
		await next();
		return;
	}

	const authHeader = c.req.header("authorization");
	if (authHeader?.startsWith("Bearer ")) {
		await next();
		return;
	}

	const cookieToken = readSessionCookie(c);
	if (!cookieToken) {
		await next();
		return;
	}

	const origin = c.req.header("origin");
	if (!isAllowedWebOrigin(origin)) {
		throw new AppError(403, "FORBIDDEN", "Origin not allowed");
	}

	await next();
};
