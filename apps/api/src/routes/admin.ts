import { AuditActorType } from "@taskflow/db";
import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";

import { normalizeEmail } from "../lib/email.js";
import { getClientIp } from "../lib/http.js";
import { getMetricsSnapshot } from "../lib/metrics.js";
import { getQueueStats } from "../lib/queue.js";
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
import {
	listAuditLogs,
	recordAuditLog,
	verifyAuditLogs,
} from "../services/audit.service.js";

import type { AppVariables } from "../types/context.js";

const userIdParamSchema = z.object({
	userId: z.string().uuid(),
});

const schoolIdParamSchema = z.object({
	schoolId: z.string().uuid(),
});

const patchConfigSchema = z.record(z.string(), z.string());
const sendTestEmailSchema = z.object({
	to: z.string().trim().email().transform(normalizeEmail),
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
	publishMode: z.enum(["immediate", "delayed"]).default("delayed"),
});

const announcementIdParamSchema = z.object({
	announcementId: z.string().uuid(),
});

export const adminRouter = new Hono<{ Variables: AppVariables }>();

adminRouter.use("*", adminMiddleware);

const auditLogQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).optional(),
	cursor: z.string().regex(/^\d+$/).optional(),
	action: z.string().trim().min(1).optional(),
	actorUserId: z.string().uuid().optional(),
	targetType: z.string().trim().min(1).optional(),
	targetId: z.string().trim().min(1).optional(),
	classId: z.string().uuid().optional(),
	from: z
		.string()
		.datetime()
		.transform((value) => new Date(value))
		.optional(),
	to: z
		.string()
		.datetime()
		.transform((value) => new Date(value))
		.optional(),
});

const auditVerifyBodySchema = z
	.object({
		from: z
			.string()
			.datetime()
			.transform((value) => new Date(value))
			.optional(),
		to: z
			.string()
			.datetime()
			.transform((value) => new Date(value))
			.optional(),
	})
	.default({});

function auditRequestMeta(c: Context<{ Variables: AppVariables }>) {
	return {
		ipAddress: getClientIp(c),
		userAgent: c.req.header("user-agent") ?? null,
		requestId: c.get("requestId") ?? null,
	};
}

function adminActor() {
	return { type: AuditActorType.ADMIN };
}

adminRouter.get("/config", async (c) => {
	const config = await getAdminConfig();
	return c.json(config, 200);
});

adminRouter.patch("/config", async (c) => {
	const body = patchConfigSchema.parse(await c.req.json());
	const config = await patchAdminConfig(body);
	await recordAuditLog({
		action: "ADMIN_CONFIG_UPDATED",
		actor: adminActor(),
		targetType: "SYSTEM_CONFIG",
		metadata: { keys: Object.keys(body).sort() },
		...auditRequestMeta(c),
	});
	return c.json(config, 200);
});

adminRouter.post("/config/test-email", async (c) => {
	const body = sendTestEmailSchema.parse(await c.req.json());
	await sendAdminTestEmail(body.to);
	await recordAuditLog({
		action: "ADMIN_TEST_EMAIL_SENT",
		actor: adminActor(),
		targetType: "EMAIL",
		metadata: { to: body.to },
		...auditRequestMeta(c),
	});
	return c.body(null, 204);
});

adminRouter.get("/storage-status", async (c) => {
	const status = await getStorageStatus();
	return c.json(status, 200);
});

adminRouter.get("/metrics", (c) => {
	return c.json(getMetricsSnapshot(), 200);
});

adminRouter.get("/queue", async (c) => {
	const stats = await getQueueStats();
	return c.json(stats, 200);
});

adminRouter.get("/users", async (c) => {
	const users = await listAdminUsers();
	return c.json(users, 200);
});

adminRouter.patch("/users/:userId", async (c) => {
	const params = userIdParamSchema.parse(c.req.param());
	const body = patchAdminUserSchema.parse(await c.req.json());
	const user = await updateAdminUser(params.userId, body);
	if (body.isActive !== undefined) {
		await recordAuditLog({
			action: "ADMIN_USER_UPDATED",
			actor: adminActor(),
			targetType: "USER",
			targetId: params.userId,
			metadata: { isActive: body.isActive },
			...auditRequestMeta(c),
		});
	}
	if (body.password) {
		await recordAuditLog({
			action: "ADMIN_USER_PASSWORD_RESET",
			actor: adminActor(),
			targetType: "USER",
			targetId: params.userId,
			...auditRequestMeta(c),
		});
	}
	return c.json(user, 200);
});

adminRouter.delete("/users/:userId", async (c) => {
	const params = userIdParamSchema.parse(c.req.param());
	await deleteAdminUser(params.userId);
	await recordAuditLog({
		action: "ADMIN_USER_DELETED",
		actor: adminActor(),
		targetType: "USER",
		targetId: params.userId,
		...auditRequestMeta(c),
	});
	return c.body(null, 204);
});

adminRouter.get("/schools", async (c) => {
	const schools = await listAdminSchools();
	return c.json(schools, 200);
});

adminRouter.post("/schools", async (c) => {
	const body = createSchoolSchema.parse(await c.req.json());
	const school = await createAdminSchool(body.name);
	await recordAuditLog({
		action: "ADMIN_SCHOOL_CREATED",
		actor: adminActor(),
		targetType: "SCHOOL",
		targetId: school.id,
		metadata: { name: school.name },
		...auditRequestMeta(c),
	});
	return c.json(school, 201);
});

adminRouter.delete("/schools/:schoolId", async (c) => {
	const params = schoolIdParamSchema.parse(c.req.param());
	await deleteAdminSchool(params.schoolId);
	await recordAuditLog({
		action: "ADMIN_SCHOOL_DELETED",
		actor: adminActor(),
		targetType: "SCHOOL",
		targetId: params.schoolId,
		...auditRequestMeta(c),
	});
	return c.body(null, 204);
});

// ── Audit Logs ─────────────────────────────────────────────────────────────

adminRouter.get("/audit-logs", async (c) => {
	const query = auditLogQuerySchema.parse(c.req.query());
	const result = await listAuditLogs(query);
	return c.json(result, 200);
});

adminRouter.post("/audit-logs/verify", async (c) => {
	const bodyText = await c.req.text();
	const body = auditVerifyBodySchema.parse(
		bodyText.trim() ? JSON.parse(bodyText) : {},
	);
	const result = await verifyAuditLogs(body);
	return c.json(result, 200);
});

// ── Announcements ──────────────────────────────────────────────────────────

adminRouter.get("/announcements", async (c) => {
	const announcements = await listAnnouncements();
	return c.json(announcements, 200);
});

adminRouter.post("/announcements", async (c) => {
	const body = createAnnouncementSchema.parse(await c.req.json());
	const announcement = await createAnnouncement(
		body.title,
		body.content,
		body.publishMode,
	);
	await recordAuditLog({
		action: "ADMIN_ANNOUNCEMENT_CREATED",
		actor: adminActor(),
		targetType: "ANNOUNCEMENT",
		targetId: announcement.id,
		metadata: { publishMode: body.publishMode, status: announcement.status },
		...auditRequestMeta(c),
	});
	return c.json(announcement, 201);
});

adminRouter.post("/announcements/:announcementId/cancel", async (c) => {
	const params = announcementIdParamSchema.parse(c.req.param());
	const result = await cancelAnnouncement(params.announcementId);
	if (!result) {
		return c.json({ error: "Not found", code: "NOT_FOUND" }, 404);
	}
	await recordAuditLog({
		action: "ADMIN_ANNOUNCEMENT_CANCELLED",
		actor: adminActor(),
		targetType: "ANNOUNCEMENT",
		targetId: params.announcementId,
		metadata: { status: result.status },
		...auditRequestMeta(c),
	});
	return c.json(result, 200);
});
