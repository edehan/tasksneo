import { Hono } from "hono";
import { z } from "zod";

import { requireAuthUser } from "../lib/context.js";
import { authMiddleware } from "../middleware/auth.js";
import {
	createClass,
	deleteClass,
	getClassDetail,
	getClassInvitePreview,
	joinClass,
	listClassMembers,
	listMyClasses,
	refreshInviteCode,
	removeMember,
	transferOwnership,
	updateClass,
	updateMemberRole,
} from "../services/class.service.js";
import { resolveClassId } from "../services/resource-id.service.js";
import {
	createClassTask,
	createClassTaskDraft,
	findMyClassDraft,
	listClassTasks,
} from "../services/task.service.js";

import type { AppVariables } from "../types/context.js";

const classIdParamSchema = z.object({
	classId: z.string().trim().min(1),
});

const memberParamSchema = z.object({
	classId: z.string().trim().min(1),
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
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional(),
});

const joinClassBodySchema = z.object({
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

classesRouter.get("/invite/:inviteCode", async (c) => {
	const inviteCode = c.req.param("inviteCode").trim();
	const preview = await getClassInvitePreview(inviteCode);
	return c.json(preview, 200);
});

classesRouter.use("*", authMiddleware);

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
	return c.json(joinedClass, 200);
});

classesRouter.get("/:classId", async (c) => {
	const authUser = requireAuthUser(c);
	const params = classIdParamSchema.parse(c.req.param());
	const classId = await resolveClassId(params.classId);
	const classInfo = await getClassDetail(classId, authUser.userId);
	return c.json(classInfo, 200);
});

classesRouter.patch("/:classId", async (c) => {
	const authUser = requireAuthUser(c);
	const params = classIdParamSchema.parse(c.req.param());
	const body = updateClassBodySchema.parse(await c.req.json());
	const classId = await resolveClassId(params.classId);
	const classInfo = await updateClass(classId, authUser.userId, body);
	return c.json(classInfo, 200);
});

classesRouter.delete("/:classId", async (c) => {
	const authUser = requireAuthUser(c);
	const params = classIdParamSchema.parse(c.req.param());
	const classId = await resolveClassId(params.classId);
	await deleteClass(classId, authUser.userId);
	return c.body(null, 204);
});

classesRouter.post("/:classId/invite-code", async (c) => {
	const authUser = requireAuthUser(c);
	const params = classIdParamSchema.parse(c.req.param());
	const classId = await resolveClassId(params.classId);
	const result = await refreshInviteCode(classId, authUser.userId);
	return c.json(result, 200);
});

classesRouter.post("/:classId/transfer", async (c) => {
	const authUser = requireAuthUser(c);
	const params = classIdParamSchema.parse(c.req.param());
	const body = transferBodySchema.parse(await c.req.json());
	const classId = await resolveClassId(params.classId);
	const classInfo = await transferOwnership(
		classId,
		authUser.userId,
		body.newOwnerId,
	);
	return c.json(classInfo, 200);
});

classesRouter.get("/:classId/members", async (c) => {
	const authUser = requireAuthUser(c);
	const params = classIdParamSchema.parse(c.req.param());
	const classId = await resolveClassId(params.classId);
	const members = await listClassMembers(classId, authUser.userId);
	return c.json(members, 200);
});

classesRouter.get("/:classId/tasks", async (c) => {
	const authUser = requireAuthUser(c);
	const params = classIdParamSchema.parse(c.req.param());
	const classId = await resolveClassId(params.classId);
	const tasks = await listClassTasks(classId, authUser.userId);
	return c.json(tasks, 200);
});

classesRouter.post("/:classId/tasks", async (c) => {
	const authUser = requireAuthUser(c);
	const params = classIdParamSchema.parse(c.req.param());
	const body = createTaskBodySchema.parse(await c.req.json());
	const classId = await resolveClassId(params.classId);
	const task = await createClassTask(classId, authUser.userId, body);
	return c.json(task, 201);
});

classesRouter.get("/:classId/tasks/drafts/mine", async (c) => {
	const authUser = requireAuthUser(c);
	const params = classIdParamSchema.parse(c.req.param());
	const classId = await resolveClassId(params.classId);
	const draft = await findMyClassDraft(classId, authUser.userId);
	return c.json({ draft }, 200);
});

classesRouter.post("/:classId/tasks/drafts", async (c) => {
	const authUser = requireAuthUser(c);
	const params = classIdParamSchema.parse(c.req.param());
	const body = createTaskDraftBodySchema.parse(await c.req.json());
	const classId = await resolveClassId(params.classId);
	const task = await createClassTaskDraft(
		classId,
		authUser.userId,
		body,
	);
	return c.json(task, 201);
});

classesRouter.patch("/:classId/members/:userId", async (c) => {
	const authUser = requireAuthUser(c);
	const params = memberParamSchema.parse(c.req.param());
	const body = updateMemberRoleSchema.parse(await c.req.json());
	const classId = await resolveClassId(params.classId);
	const member = await updateMemberRole(
		classId,
		authUser.userId,
		params.userId,
		body.role,
	);
	return c.json(member, 200);
});

classesRouter.delete("/:classId/members/:userId", async (c) => {
	const authUser = requireAuthUser(c);
	const params = memberParamSchema.parse(c.req.param());
	const classId = await resolveClassId(params.classId);
	await removeMember(classId, authUser.userId, params.userId);
	return c.body(null, 204);
});
