import { Hono } from "hono";
import { z } from "zod";

import { getStorageStatus } from "../lib/storage.js";
import { adminMiddleware } from "../middleware/admin.js";
import {
	createAdminSchool,
	deleteAdminSchool,
	deleteAdminUser,
	getAdminConfig,
	listAdminSchools,
	listAdminUsers,
	patchAdminConfig,
	sendAdminTestEmail,
	updateAdminUser,
} from "../services/admin.service.js";
import {
	cancelAnnouncement,
	createAnnouncement,
	listAnnouncements,
} from "../services/announcement.service.js";

import type { AppVariables } from "../types/context.js";

const userIdParamSchema = z.object({
	userId: z.string().uuid(),
});

const schoolIdParamSchema = z.object({
	schoolId: z.string().uuid(),
});

const patchConfigSchema = z.record(z.string(), z.string());
const sendTestEmailSchema = z.object({
	to: z.string().email(),
});

const patchAdminUserSchema = z.object({
	isActive: z.boolean().optional(),
	password: z.string().min(8).optional(),
});

const createSchoolSchema = z.object({
	name: z.string().trim().min(1),
});

const createAnnouncementSchema = z.object({
	title: z.string().trim().min(1).max(200),
	content: z.string().trim().min(1).max(5000),
});

const announcementIdParamSchema = z.object({
	announcementId: z.string().uuid(),
});

export const adminRouter = new Hono<{ Variables: AppVariables }>();

adminRouter.use("*", adminMiddleware);

adminRouter.get("/config", async (c) => {
	const config = await getAdminConfig();
	return c.json(config, 200);
});

adminRouter.patch("/config", async (c) => {
	const body = patchConfigSchema.parse(await c.req.json());
	const config = await patchAdminConfig(body);
	return c.json(config, 200);
});

adminRouter.post("/config/test-email", async (c) => {
	const body = sendTestEmailSchema.parse(await c.req.json());
	await sendAdminTestEmail(body.to);
	return c.body(null, 204);
});

adminRouter.get("/storage-status", async (c) => {
	const status = await getStorageStatus();
	return c.json(status, 200);
});

adminRouter.get("/users", async (c) => {
	const users = await listAdminUsers();
	return c.json(users, 200);
});

adminRouter.patch("/users/:userId", async (c) => {
	const params = userIdParamSchema.parse(c.req.param());
	const body = patchAdminUserSchema.parse(await c.req.json());
	const user = await updateAdminUser(params.userId, body);
	return c.json(user, 200);
});

adminRouter.delete("/users/:userId", async (c) => {
	const params = userIdParamSchema.parse(c.req.param());
	await deleteAdminUser(params.userId);
	return c.body(null, 204);
});

adminRouter.get("/schools", async (c) => {
	const schools = await listAdminSchools();
	return c.json(schools, 200);
});

adminRouter.post("/schools", async (c) => {
	const body = createSchoolSchema.parse(await c.req.json());
	const school = await createAdminSchool(body.name);
	return c.json(school, 201);
});

adminRouter.delete("/schools/:schoolId", async (c) => {
	const params = schoolIdParamSchema.parse(c.req.param());
	await deleteAdminSchool(params.schoolId);
	return c.body(null, 204);
});

// ── Announcements ──────────────────────────────────────────────────────────

adminRouter.get("/announcements", async (c) => {
	const announcements = await listAnnouncements();
	return c.json(announcements, 200);
});

adminRouter.post("/announcements", async (c) => {
	const body = createAnnouncementSchema.parse(await c.req.json());
	const announcement = await createAnnouncement(body.title, body.content);
	return c.json(announcement, 201);
});

adminRouter.post("/announcements/:announcementId/cancel", async (c) => {
	const params = announcementIdParamSchema.parse(c.req.param());
	const result = await cancelAnnouncement(params.announcementId);
	if (!result) {
		return c.json({ error: "Not found", code: "NOT_FOUND" }, 404);
	}
	return c.json(result, 200);
});
