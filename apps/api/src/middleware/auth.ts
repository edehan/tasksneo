import { prisma } from "@taskflow/db";
import type { MiddlewareHandler } from "hono";
import { getJwtSecret } from "../lib/env.js";
import { AppError } from "../lib/errors.js";
import { verifyUserJwt } from "../lib/jwt.js";
import type { AppVariables } from "../types/context.js";

export const authMiddleware: MiddlewareHandler<{
	Variables: AppVariables;
}> = async (c, next) => {
	const authHeader = c.req.header("authorization");

	if (!authHeader?.startsWith("Bearer ")) {
		throw new AppError(401, "UNAUTHORIZED", "Missing bearer token");
	}

	const token = authHeader.slice("Bearer ".length).trim();
	const payload = verifyUserJwt(token, getJwtSecret());

	const user = await prisma.user.findUnique({ where: { id: payload.sub } });

	if (!user) {
		throw new AppError(401, "UNAUTHORIZED", "User not found");
	}

	if (!user.isActive) {
		throw new AppError(403, "USER_INACTIVE", "Account is disabled");
	}

	c.set("authUser", { userId: user.id, email: user.email });
	await next();
};
