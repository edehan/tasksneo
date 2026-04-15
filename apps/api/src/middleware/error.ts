import type { ErrorHandler } from "hono";
import { ZodError } from "zod";

import { AppError } from "../lib/errors.js";
import { rootLogger } from "../lib/logger.js";
import type { AppVariables } from "../types/context.js";

const prismaUniqueErrorCode = "P2002";

export const errorHandler: ErrorHandler<{ Variables: AppVariables }> = (
	error,
	c,
) => {
	const logger = c.get("logger") ?? rootLogger;
	const route = c.req.routePath || c.req.path;

	if (error instanceof AppError) {
		const base = {
			code: error.code,
			status: error.status,
			route,
			method: c.req.method,
			err: {
				message: error.message,
				stack: error.stack,
			},
		};

		if (error.status >= 500) {
			logger.error(base, "app_error");
		} else if (error.status === 401) {
			logger.debug(base, "app_error");
		} else {
			logger.warn(base, "app_error");
		}

		return c.json({ error: error.message, code: error.code }, error.status);
	}

	if (error instanceof ZodError) {
		logger.warn(
			{
				route,
				method: c.req.method,
				issues: error.issues,
			},
			"validation_error",
		);
		return c.json(
			{
				error: "Invalid request body",
				code: "VALIDATION_ERROR",
			},
			400,
		);
	}

	if (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === prismaUniqueErrorCode
	) {
		logger.warn(
			{
				route,
				method: c.req.method,
				prismaCode: prismaUniqueErrorCode,
			},
			"prisma_conflict",
		);
		return c.json({ error: "Resource already exists", code: "CONFLICT" }, 409);
	}

	logger.error(
		{
			route,
			method: c.req.method,
			err: error,
		},
		"unhandled_error",
	);
	return c.json(
		{ error: "Internal server error", code: "INTERNAL_SERVER_ERROR" },
		500,
	);
};
