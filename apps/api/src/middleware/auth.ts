import { prisma } from "@taskflow/db";
import type { MiddlewareHandler } from "hono";
import { cacheGetOrSet, cacheKeys } from "../lib/cache.js";
import { getJwtSecret } from "../lib/env.js";
import { AppError } from "../lib/errors.js";
import { verifyUserJwt } from "../lib/jwt.js";
import type { AppVariables } from "../types/context.js";

const AUTH_USER_TTL_SECONDS = 600; // 10 min — bounds the banned-user lockout window.

interface AuthUserCacheEntry {
	id: string;
	email: string;
	isActive: boolean;
}

export const authMiddleware: MiddlewareHandler<{
	Variables: AppVariables;
}> = async (c, next) => {
	const authHeader = c.req.header("authorization");

	if (!authHeader?.startsWith("Bearer ")) {
		throw new AppError(401, "UNAUTHORIZED", "Missing bearer token");
	}

	const token = authHeader.slice("Bearer ".length).trim();
	const payload = verifyUserJwt(token, getJwtSecret());

	const user = await cacheGetOrSet<AuthUserCacheEntry | null>(
		cacheKeys.authUser(payload.sub),
		AUTH_USER_TTL_SECONDS,
		async () => {
			const row = await prisma.user.findUnique({
				where: { id: payload.sub },
				select: { id: true, email: true, isActive: true },
			});
			return row ?? null;
		},
	);

	if (!user) {
		throw new AppError(401, "UNAUTHORIZED", "User not found");
	}

	if (!user.isActive) {
		throw new AppError(403, "USER_INACTIVE", "Account is disabled");
	}

	c.set("authUser", { userId: user.id, email: user.email });
	await next();
};
