import { Hono } from "hono";
import { requireAuthUser } from "../lib/context.js";
import { AppError } from "../lib/errors.js";
import { authMiddleware } from "../middleware/auth.js";
import { getConfigValues } from "../services/system-config.service.js";

import type { AppVariables } from "../types/context.js";

export const sttRouter = new Hono<{ Variables: AppVariables }>();

sttRouter.use("*", authMiddleware);

sttRouter.post("/token", async (c) => {
	requireAuthUser(c);

	const config = await getConfigValues(["stt.api_key", "stt.speech_model"]);
	const apiKey = config.get("stt.api_key");
	const speechModel = config.get("stt.speech_model") ?? "whisper-rt";

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

	return c.json({ token: data.token, speechModel }, 200);
});
