import type { MiddlewareHandler } from "hono";

import { AppError } from "../lib/errors.js";
import {
	isSessionToken,
	loadSessionByToken,
	touchSession,
} from "../services/session.service.js";
import type { AppVariables } from "../types/context.js";

export const authMiddleware: MiddlewareHandler<{
	Variables: AppVariables;
}> = async (c, next) => {
	const authHeader = c.req.header("authorization");

	if (!authHeader?.startsWith("Bearer ")) {
		throw new AppError(401, "UNAUTHORIZED", "Missing bearer token");
	}

	const token = authHeader.slice("Bearer ".length).trim();

	if (!isSessionToken(token)) {
		throw new AppError(401, "INVALID_TOKEN", "Invalid or expired token");
	}

	let session = await loadSessionByToken(token);

	if (!session) {
		throw new AppError(401, "INVALID_TOKEN", "Invalid or expired token");
	}

	if (!session.isActive) {
		throw new AppError(403, "USER_INACTIVE", "Account is disabled");
	}

	// Touch is debounced to once per hour per session, so this is a no-op on
	// the vast majority of requests. For trusted browser sessions it also
	// slides the expiresAt forward in the same UPDATE.
	session = await touchSession(session);

	c.set("authUser", { userId: session.userId, email: session.email });
	c.set("authSession", {
		id: session.id,
		userId: session.userId,
		kind: session.kind,
		isTrusted: session.isTrusted,
		mcpKeyId: session.mcpKeyId,
	});

	await next();
};
