import { Hono } from "hono";
import { z } from "zod";

import { login } from "../services/auth.service.js";
import { exchangeMcpKey } from "../services/mcp-key.service.js";
import {
	completeRegistration,
	resetPassword,
	sendPasswordResetEmail,
	sendRegistrationEmail,
	verifyPasswordResetToken,
	verifyRegistrationToken,
} from "../services/email-verification.service.js";

const registerStep1Schema = z.object({
	email: z.string().email(),
});

const registerCompleteSchema = z.object({
	token: z.string().min(1),
	password: z.string().min(8),
	nickname: z.string().optional().nullable(),
	schoolId: z.string().uuid().optional().nullable(),
	studentId: z.string().optional().nullable(),
	timezone: z.string().max(64).optional(),
});

const loginBodySchema = z.object({
	email: z.string().email(),
	password: z.string(),
});

const forgotPasswordSchema = z.object({
	email: z.string().email(),
});

const resetPasswordSchema = z.object({
	token: z.string().min(1),
	password: z.string().min(8),
});

const mcpKeySchema = z.object({
	key: z.string().min(1),
});

const verifyTokenSchema = z.object({
	token: z.string().min(1),
	purpose: z.enum(["REGISTRATION", "PASSWORD_RESET"]),
});

export const authRouter = new Hono();

// Step 1: send verification email
authRouter.post("/register", async (c) => {
	const body = registerStep1Schema.parse(await c.req.json());
	await sendRegistrationEmail(body.email);
	return c.json({ message: "Verification email sent" }, 200);
});

// Step 2: complete registration after email verification
authRouter.post("/register/complete", async (c) => {
	const body = registerCompleteSchema.parse(await c.req.json());
	const result = await completeRegistration(body.token, {
		password: body.password,
		nickname: body.nickname,
		schoolId: body.schoolId,
		studentId: body.studentId,
		timezone: body.timezone,
	});
	return c.json(result, 201);
});

authRouter.post("/login", async (c) => {
	const body = loginBodySchema.parse(await c.req.json());
	const result = await login(body);
	return c.json(result, 200);
});

authRouter.post("/forgot-password", async (c) => {
	const body = forgotPasswordSchema.parse(await c.req.json());
	await sendPasswordResetEmail(body.email);
	// Always return success to prevent email enumeration
	return c.json(
		{ message: "If the email exists, a reset link has been sent" },
		200,
	);
});

authRouter.post("/reset-password", async (c) => {
	const body = resetPasswordSchema.parse(await c.req.json());
	const result = await resetPassword(body.token, body.password);
	return c.json(result, 200);
});

authRouter.post("/mcp", async (c) => {
	const body = mcpKeySchema.parse(await c.req.json());
	const result = await exchangeMcpKey(body.key);
	return c.json(result, 200);
});

authRouter.get("/verify-token", async (c) => {
	const query = verifyTokenSchema.parse(c.req.query());

	if (query.purpose === "REGISTRATION") {
		const result = await verifyRegistrationToken(query.token);
		return c.json(result, 200);
	}

	const result = await verifyPasswordResetToken(query.token);
	return c.json(result, 200);
});
