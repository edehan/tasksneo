import type { ErrorHandler } from "hono";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";

const prismaUniqueErrorCode = "P2002";

export const errorHandler: ErrorHandler = (error, c) => {
	if (error instanceof AppError) {
		return c.json({ error: error.message, code: error.code }, error.status);
	}

	if (error instanceof ZodError) {
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
		return c.json({ error: "Resource already exists", code: "CONFLICT" }, 409);
	}

	console.error(error);
	return c.json(
		{ error: "Internal server error", code: "INTERNAL_SERVER_ERROR" },
		500,
	);
};
