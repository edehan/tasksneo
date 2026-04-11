import type { Context } from "hono";
import type { AppVariables, AuthSession, AuthUser } from "../types/context.js";
import { AppError } from "./errors.js";

export function requireAuthUser(
	c: Context<{ Variables: AppVariables }>,
): AuthUser {
	const user = c.get("authUser");

	if (!user) {
		throw new AppError(401, "UNAUTHORIZED", "Missing auth context");
	}

	return user;
}

export function requireAuthSession(
	c: Context<{ Variables: AppVariables }>,
): AuthSession {
	const session = c.get("authSession");

	if (!session) {
		throw new AppError(401, "UNAUTHORIZED", "Missing auth context");
	}

	return session;
}
