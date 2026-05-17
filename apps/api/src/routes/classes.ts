import { AuditActorType } from "@taskflow/db";
import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";

import { requireAuthUser } from "../lib/context.js";
import { getClientIp } from "../lib/http.js";
import { authMiddleware } from "../middleware/auth.js";
import { recordAuditLog } from "../services/audit.service.js";
import {
	createClass,
	deleteClass,
	getClassDetail,
	getJoinClassPreview,
	joinClass,
	listClassMembers,
	listMyClasses,
	refreshInviteCode,
	removeMember,
	transferOwnership,
	updateClass,
	updateMemberRole,
} from "../services/class.service.js";
import {
	createClassTask,
	createClassTaskDraft,
	findMyClassDraft,
	listClassTasks,
} from "../services/task.service.js";

import type { AppVariables } from "../types/context.js";

const classIdParamSchema = z.object({
	classId: z.string().uuid(),
});

const memberParamSchema = z.object({
	classId: z.string().uuid(),
	userId: z.string().uuid(),
});

const createClassBodySchema = z.object({
	name: z.string().trim().min(1),
	description: z.string().optional().nullable(),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional(),
	schoolId: z.string().uuid().optional().nullable(),
});

const updateClassBodySchema = z.object({
	name: z.string().trim().min(1).optional(),
	description: z.string().optional().nullable(),
	taskAiPrompt: z.string().optional().nullable(),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional(),
	schoolId: z.string().uuid().optional().nullable(),
});

const joinClassBodySchema = z.object({
	inviteCode: z.string().trim().min(1),
});

const joinClassPreviewParamSchema = z.object({
	inviteCode: z.string().trim().min(1),
});

const transferBodySchema = z.object({
	newOwnerId: z.string().uuid(),
});

const updateMemberRoleSchema = z.object({
	role: z.enum(["ADMIN", "MEMBER"]),
});

const createTaskBodySchema = z.object({
	title: z.string().trim().min(1),
	description: z.string().optional().nullable(),
	sourceText: z.string().optional().nullable(),
	startAt: z.string().datetime().optional().nullable(),
	dueAt: z.string().datetime().optional().nullable(),
	allowLateSubmission: z.boolean().optional(),
	blockedBy: z.array(z.string().uuid()).optional(),
});

const createTaskDraftBodySchema = z.object({
	title: z.string().trim().min(1).optional(),
	description: z.string().optional().nullable(),
	sourceText: z.string().optional().nullable(),
	startAt: z.string().datetime().optional().nullable(),
	dueAt: z.string().datetime().optional().nullable(),
	allowLateSubmission: z.boolean().optional(),
	blockedBy: z.array(z.string().uuid()).optional(),
});

export const classesRouter = new Hono<{ Variables: AppVariables }>();

classesRouter.use("*", authMiddleware);

function auditRequestMeta(c: Context<{ Variables: AppVariables }>) {
	return {
		ipAddress: getClientIp(c),
		userAgent: c.req.header("user-agent") ?? null,
		requestId: c.get("requestId") ?? null,
	};
}

classesRouter.get("/", async (c) => {
	const authUser = requireAuthUser(c);
	const classes = await listMyClasses(authUser.userId);
	return c.json(classes, 200);
});

classesRouter.post("/", async (c) => {
	const authUser = requireAuthUser(c);
	const body = createClassBodySchema.parse(await c.req.json());
	const createdClass = await createClass(authUser.userId, body);
	return c.json(createdClass, 201);
});

classesRouter.post("/join", async (c) => {
	const authUser = requireAuthUser(c);
	const body = joinClassBodySchema.parse(await c.req.json());
	const joinedClass = await joinClass(authUser.userId, body.inviteCode);
	await recordAuditLog({
		action: "CLASS_MEMBER_JOINED",
		actor: { type: AuditActorType.USER, userId: authUser.userId },
		targetType: "USER",
		targetId: authUser.userId,
		classId: joinedClass.id,
		metadata: { className: joinedClass.name },
		...auditRequestMeta(c),
	});
	return c.json(joinedClass, 200);
});

classesRouter.get("/join-preview/:inviteCode", async (c) => {
	const authUser = requireAuthUser(c);
	const params = joinClassPreviewParamSchema.parse(c.req.param());
	const preview = await getJoinClassPreview(authUser.userId, params.inviteCode);
	return c.json(preview, 200);
});

classesRouter.get("/:classId", async (c) => {
	const authUser = requireAuthUser(c);
	const params = classIdParamSchema.parse(c.req.param());
	const classInfo = await getClassDetail(params.classId, authUser.userId);
	return c.json(classInfo, 200);
});

classesRouter.patch("/:classId", async (c) => {
	const authUser = requireAuthUser(c);
	const params = classIdParamSchema.parse(c.req.param());
	const body = updateClassBodySchema.parse(await c.req.json());
	const classInfo = await updateClass(params.classId, authUser.userId, body);
	return c.json(classInfo, 200);
});

classesRouter.delete("/:classId", async (c) => {
	const authUser = requireAuthUser(c);
	const params = classIdParamSchema.parse(c.req.param());
	await deleteClass(params.classId, authUser.userId);
	await recordAuditLog({
		action: "CLASS_DELETED",
		actor: { type: AuditActorType.USER, userId: authUser.userId },
		targetType: "CLASS",
		targetId: params.classId,
		classId: params.classId,
		...auditRequestMeta(c),
	});
	return c.body(null, 204);
});

classesRouter.post("/:classId/invite-code", async (c) => {
	const authUser = requireAuthUser(c);
	const params = classIdParamSchema.parse(c.req.param());
	const result = await refreshInviteCode(params.classId, authUser.userId);
	return c.json(result, 200);
});

classesRouter.post("/:classId/transfer", async (c) => {
	const authUser = requireAuthUser(c);
	const params = classIdParamSchema.parse(c.req.param());
	const body = transferBodySchema.parse(await c.req.json());
	const classInfo = await transferOwnership(
		params.classId,
		authUser.userId,
		body.newOwnerId,
	);
	await recordAuditLog({
		action: "CLASS_OWNERSHIP_TRANSFERRED",
		actor: { type: AuditActorType.USER, userId: authUser.userId },
		targetType: "CLASS",
		targetId: params.classId,
		classId: params.classId,
		metadata: {
			previousOwnerId: authUser.userId,
			newOwnerId: body.newOwnerId,
			className: classInfo.name,
		},
		...auditRequestMeta(c),
	});
	return c.json(classInfo, 200);
});

classesRouter.get("/:classId/members", async (c) => {
	const authUser = requireAuthUser(c);
	const params = classIdParamSchema.parse(c.req.param());
	const members = await listClassMembers(params.classId, authUser.userId);
	return c.json(members, 200);
});

classesRouter.get("/:classId/tasks", async (c) => {
	const authUser = requireAuthUser(c);
	const params = classIdParamSchema.parse(c.req.param());
	const tasks = await listClassTasks(params.classId, authUser.userId);
	return c.json(tasks, 200);
});

classesRouter.post("/:classId/tasks", async (c) => {
	const authUser = requireAuthUser(c);
	const params = classIdParamSchema.parse(c.req.param());
	const body = createTaskBodySchema.parse(await c.req.json());
	const task = await createClassTask(params.classId, authUser.userId, body);
	return c.json(task, 201);
});

classesRouter.get("/:classId/tasks/drafts/mine", async (c) => {
	const authUser = requireAuthUser(c);
	const params = classIdParamSchema.parse(c.req.param());
	const draft = await findMyClassDraft(params.classId, authUser.userId);
	return c.json({ draft }, 200);
});

classesRouter.post("/:classId/tasks/drafts", async (c) => {
	const authUser = requireAuthUser(c);
	const params = classIdParamSchema.parse(c.req.param());
	const body = createTaskDraftBodySchema.parse(await c.req.json());
	const task = await createClassTaskDraft(
		params.classId,
		authUser.userId,
		body,
	);
	return c.json(task, 201);
});

classesRouter.patch("/:classId/members/:userId", async (c) => {
	const authUser = requireAuthUser(c);
	const params = memberParamSchema.parse(c.req.param());
	const body = updateMemberRoleSchema.parse(await c.req.json());
	const member = await updateMemberRole(
		params.classId,
		authUser.userId,
		params.userId,
		body.role,
	);
	await recordAuditLog({
		action: "CLASS_MEMBER_ROLE_UPDATED",
		actor: { type: AuditActorType.USER, userId: authUser.userId },
		targetType: "USER",
		targetId: params.userId,
		classId: params.classId,
		metadata: { role: body.role, updatedRole: member.role },
		...auditRequestMeta(c),
	});
	return c.json(member, 200);
});

classesRouter.delete("/:classId/members/:userId", async (c) => {
	const authUser = requireAuthUser(c);
	const params = memberParamSchema.parse(c.req.param());
	await removeMember(params.classId, authUser.userId, params.userId);
	await recordAuditLog({
		action:
			authUser.userId === params.userId
				? "CLASS_MEMBER_LEFT"
				: "CLASS_MEMBER_REMOVED",
		actor: { type: AuditActorType.USER, userId: authUser.userId },
		targetType: "USER",
		targetId: params.userId,
		classId: params.classId,
		...auditRequestMeta(c),
	});
	return c.body(null, 204);
});
