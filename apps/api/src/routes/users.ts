import { NotifChannel } from "@taskflow/db";
import type { MiddlewareHandler } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import { verifyCaptcha } from "../lib/captcha.js";
import { requireAuthSession, requireAuthUser } from "../lib/context.js";
import { clearSessionCookie } from "../lib/cookie.js";
import { authMiddleware } from "../middleware/auth.js";
import {
	confirmEmailChange,
	sendEmailChangeVerification,
} from "../services/email-verification.service.js";
import {
	createMcpKey,
	listMcpKeys,
	revokeMcpKey,
} from "../services/mcp-key.service.js";
import {
	getUnreadNotificationCount,
	listMyNotifications,
	markAllNotificationsRead,
	markNotificationRead,
} from "../services/notification.service.js";
import {
	listUserSessions,
	revokeAllBrowserSessions,
	revokeSession,
} from "../services/session.service.js";
import {
	deleteMyAccount,
	getMyProfile,
	listMyNotificationPrefs,
	updateMyPassword,
	updateMyProfile,
	upsertMyNotificationPref,
} from "../services/user.service.js";
import type { AppVariables } from "../types/context.js";

const updateProfileSchema = z.object({
	nickname: z.string().optional().nullable(),
	schoolId: z.string().uuid().optional().nullable(),
	studentId: z.string().optional().nullable(),
	timezone: z.string().max(64).optional(),
});

const updatePasswordSchema = z.object({
	currentPassword: z.string(),
	newPassword: z.string().min(8),
});

const upsertNotificationSchema = z.object({
	channel: z.enum([
		NotifChannel.EMAIL,
		NotifChannel.WEBHOOK,
		NotifChannel.TELEGRAM,
	]),
	address: z.string().min(1),
	isEnabled: z.boolean().optional(),
});

export const usersRouter = new Hono<{ Variables: AppVariables }>();

usersRouter.use("*", authMiddleware);

usersRouter.get("/me", async (c) => {
	const authUser = requireAuthUser(c);
	const user = await getMyProfile(authUser.userId);
	return c.json(user, 200);
});

usersRouter.patch("/me", async (c) => {
	const authUser = requireAuthUser(c);
	const body = updateProfileSchema.parse(await c.req.json());
	const user = await updateMyProfile(authUser.userId, body);
	return c.json(user, 200);
});

// ── Email change ────────────────────────────────────────────────────────────

const changeEmailSchema = z.object({
	email: z.string().email(),
	captchaToken: z.string().optional(),
});

const confirmEmailSchema = z.object({
	token: z.string().min(1),
});

usersRouter.post("/me/email/change", async (c) => {
	const authUser = requireAuthUser(c);
	const body = changeEmailSchema.parse(await c.req.json());
	await verifyCaptcha(body.captchaToken);
	await sendEmailChangeVerification(authUser.userId, body.email);
	return c.json({ message: "Verification email sent" }, 200);
});

usersRouter.post("/me/email/confirm", async (c) => {
	const authUser = requireAuthUser(c);
	const body = confirmEmailSchema.parse(await c.req.json());
	const user = await confirmEmailChange(body.token, authUser.userId);
	return c.json(user, 200);
});

usersRouter.patch("/me/password", async (c) => {
	const authUser = requireAuthUser(c);
	const session = requireAuthSession(c);
	const body = updatePasswordSchema.parse(await c.req.json());
	await updateMyPassword(
		authUser.userId,
		body.currentPassword,
		body.newPassword,
		session.id,
	);
	return c.body(null, 204);
});

// ── Session management ─────────────────────────────────────────────────────

usersRouter.get("/me/sessions", async (c) => {
	const authUser = requireAuthUser(c);
	const session = requireAuthSession(c);
	const sessions = await listUserSessions(authUser.userId, session.id);
	return c.json(sessions, 200);
});

usersRouter.delete("/me/sessions", async (c) => {
	const authUser = requireAuthUser(c);
	const session = requireAuthSession(c);
	// Delete all BROWSER sessions for the user except the current one. MCP
	// sessions are revoked via the MCP keys UI.
	await revokeAllBrowserSessions(authUser.userId, session.id);
	return c.body(null, 204);
});

usersRouter.delete("/me/sessions/:sessionId", async (c) => {
	const authUser = requireAuthUser(c);
	const currentSession = requireAuthSession(c);
	const sessionId = c.req.param("sessionId");

	// Make sure the target session belongs to this user before revoking.
	const mine = await listUserSessions(authUser.userId, "");
	const target = mine.find((s) => s.id === sessionId);
	if (!target) {
		return c.json({ error: "Session not found", code: "NOT_FOUND" }, 404);
	}
	await revokeSession(sessionId);
	if (sessionId === currentSession.id) {
		clearSessionCookie(c);
	}
	return c.body(null, 204);
});

usersRouter.get("/me/notification-prefs", async (c) => {
	const authUser = requireAuthUser(c);
	const prefs = await listMyNotificationPrefs(authUser.userId);
	return c.json(prefs, 200);
});

const upsertNotificationHandler: MiddlewareHandler<{
	Variables: AppVariables;
}> = async (c) => {
	const authUser = requireAuthUser(c);
	const body = upsertNotificationSchema.parse(await c.req.json());
	const pref = await upsertMyNotificationPref(authUser.userId, body);
	return c.json(pref, 200);
};

usersRouter.put("/me/notification-prefs", upsertNotificationHandler);
usersRouter.post("/me/notification-prefs", upsertNotificationHandler);

// ── Notification inbox ──────────────────────────────────────────────────────

const listNotificationsSchema = z.object({
	limit: z.coerce.number().int().min(1).max(50).default(20),
	cursor: z.string().uuid().optional(),
	unreadOnly: z.coerce.boolean().default(false),
});

usersRouter.get("/me/notifications", async (c) => {
	const authUser = requireAuthUser(c);
	const query = listNotificationsSchema.parse(c.req.query());
	const result = await listMyNotifications(authUser.userId, {
		limit: query.limit,
		cursor: query.cursor,
		unreadOnly: query.unreadOnly,
	});
	return c.json(result, 200);
});

usersRouter.get("/me/notifications/unread-count", async (c) => {
	const authUser = requireAuthUser(c);
	const result = await getUnreadNotificationCount(authUser.userId);
	return c.json(result, 200);
});

usersRouter.patch("/me/notifications/:id/read", async (c) => {
	const authUser = requireAuthUser(c);
	const id = c.req.param("id");
	const result = await markNotificationRead(id, authUser.userId);

	if (!result) {
		return c.json({ error: "Notification not found", code: "NOT_FOUND" }, 404);
	}

	return c.json(result, 200);
});

usersRouter.post("/me/notifications/read-all", async (c) => {
	const authUser = requireAuthUser(c);
	const result = await markAllNotificationsRead(authUser.userId);
	return c.json(result, 200);
});

usersRouter.post("/me/delete", async (c) => {
	const authUser = requireAuthUser(c);
	await deleteMyAccount(authUser.userId);
	clearSessionCookie(c);
	return c.body(null, 204);
});

// ── MCP keys ───────────────────────────────────────────────────────────────

const createMcpKeySchema = z.object({
	name: z.string().trim().min(1).max(100),
});

const mcpKeyIdParamSchema = z.object({
	keyId: z.string().uuid(),
});

usersRouter.post("/me/mcp-keys", async (c) => {
	const authUser = requireAuthUser(c);
	const body = createMcpKeySchema.parse(await c.req.json());
	const key = await createMcpKey(authUser.userId, body.name);
	return c.json(key, 201);
});

usersRouter.get("/me/mcp-keys", async (c) => {
	const authUser = requireAuthUser(c);
	const keys = await listMcpKeys(authUser.userId);
	return c.json(keys, 200);
});

usersRouter.delete("/me/mcp-keys/:keyId", async (c) => {
	const authUser = requireAuthUser(c);
	const params = mcpKeyIdParamSchema.parse(c.req.param());
	const key = await revokeMcpKey(authUser.userId, params.keyId);
	return c.json(key, 200);
});
