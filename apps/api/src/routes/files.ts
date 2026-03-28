import { Hono } from "hono";
import { z } from "zod";

import { requireAuthUser } from "../lib/context.js";
import { authMiddleware } from "../middleware/auth.js";
import {
	deleteAttachment,
	getAuthorizedFileUrl,
} from "../services/file.service.js";

import type { AppVariables } from "../types/context.js";

const fileParamSchema = z.object({
	fileKey: z.string().min(1),
});

const attachmentIdParamSchema = z.object({
	attachmentId: z.string().uuid(),
});

export const filesRouter = new Hono<{ Variables: AppVariables }>();

filesRouter.use("*", authMiddleware);

filesRouter.get("/:fileKey{.+}/url", async (c) => {
	const authUser = requireAuthUser(c);
	const fileKey = c.req.param("fileKey");
	const params = fileParamSchema.parse({ fileKey });
	const url = await getAuthorizedFileUrl(params.fileKey, authUser.userId);
	return c.json({ url, expiresIn: 300 });
});

filesRouter.get("/:fileKey{.+}", async (c) => {
	const authUser = requireAuthUser(c);
	const params = fileParamSchema.parse(c.req.param());
	const url = await getAuthorizedFileUrl(params.fileKey, authUser.userId);
	return c.redirect(url, 302);
});

filesRouter.delete("/attachments/:attachmentId", async (c) => {
	const authUser = requireAuthUser(c);
	const params = attachmentIdParamSchema.parse(c.req.param());
	await deleteAttachment(params.attachmentId, authUser.userId);
	return c.body(null, 204);
});
