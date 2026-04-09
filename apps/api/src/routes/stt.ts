import { Hono } from "hono";
import { requireAuthUser } from "../lib/context.js";
import { AppError } from "../lib/errors.js";
import { authMiddleware } from "../middleware/auth.js";

import type { AppVariables } from "../types/context.js";

export const sttRouter = new Hono<{ Variables: AppVariables }>();

sttRouter.use("*", authMiddleware);

sttRouter.post("/token", async (c) => {
	requireAuthUser(c);

	const apiKey = process.env.ASSEMBLYAI_API_KEY;

	if (!apiKey) {
		throw new AppError(
			503,
			"STT_NOT_CONFIGURED",
			"Speech-to-text service is not configured",
		);
	}

	const response = await fetch(
		"https://streaming.assemblyai.com/v3/token?expires_in_seconds=480",
		{
			method: "GET",
			headers: {
				Authorization: apiKey,
			},
		},
	);

	if (!response.ok) {
		throw new AppError(503, "STT_TOKEN_FAILED", "Failed to create STT token");
	}

	const data = (await response.json()) as { token: string };

	return c.json({ token: data.token }, 200);
});
