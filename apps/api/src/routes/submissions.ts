import { Hono } from "hono";
import { z } from "zod";

import { requireAuthUser } from "../lib/context.js";
import { authMiddleware } from "../middleware/auth.js";
import { resolveSubmissionId } from "../services/resource-id.service.js";
import { getSubmissionById } from "../services/task.service.js";

import type { AppVariables } from "../types/context.js";

const submissionIdParamSchema = z.object({
	submissionId: z.string().trim().min(1),
});

export const submissionsRouter = new Hono<{ Variables: AppVariables }>();

submissionsRouter.use("*", authMiddleware);

submissionsRouter.get("/:submissionId", async (c) => {
	const authUser = requireAuthUser(c);
	const params = submissionIdParamSchema.parse(c.req.param());
	const submissionId = await resolveSubmissionId(params.submissionId);
	const submission = await getSubmissionById(
		submissionId,
		authUser.userId,
	);
	return c.json(submission, 200);
});
