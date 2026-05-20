import { randomBytes } from "node:crypto";

import { AuthProvider, EmailTokenPurpose, prisma } from "@taskflow/db";

import { cacheDel, cacheKeys } from "../lib/cache.js";
import { normalizeEmail } from "../lib/email.js";
import { AppError } from "../lib/errors.js";
import { toUserProfile } from "../lib/http.js";
import { rootLogger } from "../lib/logger.js";
import { sendEmail } from "../lib/mailer.js";
import { hashPassword } from "../lib/password.js";

import {
	createUserWithPersonalClass,
	type RegisterInput,
	type SessionMetadata,
} from "./auth.service.js";
import {
	cacheSessionByToken,
	createBrowserSession,
	revokeAllBrowserSessions,
} from "./session.service.js";
import { getConfigValue } from "./system-config.service.js";

const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const RATE_LIMIT_MAX = 5;
const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_APP_TITLE = "TaskNeo";
const PRISMA_UNIQUE_ERROR_CODE = "P2002";

async function getAppTitle() {
	const title = await getConfigValue("app.title");
	return title?.trim() || DEFAULT_APP_TITLE;
}

// ── Token CRUD ──────────────────────────────────────────────────────────────

async function createVerificationToken(
	email: string,
	purpose: EmailTokenPurpose,
	userId?: string,
): Promise<string> {
	const normalizedEmail = normalizeEmail(email);
	const count = await countRecentVerificationTokens(normalizedEmail, purpose);

	if (count >= RATE_LIMIT_MAX) {
		throw new AppError(
			429,
			"RATE_LIMITED",
			"Too many verification emails for this address. Please try again later.",
		);
	}

	return createVerificationTokenWithoutRateLimit(
		normalizedEmail,
		purpose,
		userId,
	);
}

async function countRecentVerificationTokens(
	email: string,
	purpose: EmailTokenPurpose,
) {
	const normalizedEmail = normalizeEmail(email);
	const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
	return prisma.emailVerificationToken.count({
		where: { email: normalizedEmail, purpose, createdAt: { gte: windowStart } },
	});
}

async function createVerificationTokenWithoutRateLimit(
	email: string,
	purpose: EmailTokenPurpose,
	userId?: string,
): Promise<string> {
	const normalizedEmail = normalizeEmail(email);
	const token = randomBytes(32).toString("hex");

	await prisma.emailVerificationToken.create({
		data: {
			email: normalizedEmail,
			token,
			purpose,
			userId: userId ?? null,
			expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS),
		},
	});

	return token;
}

function isPrismaUniqueError(error: unknown) {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === PRISMA_UNIQUE_ERROR_CODE
	);
}

function invalidRegistrationTokenError() {
	return new AppError(400, "INVALID_TOKEN", "Token is invalid or expired");
}

async function validateToken(token: string, purpose: EmailTokenPurpose) {
	const row = await prisma.emailVerificationToken.findUnique({
		where: { token },
	});

	if (
		!row ||
		row.purpose !== purpose ||
		row.expiresAt.getTime() <= Date.now()
	) {
		throw new AppError(400, "INVALID_TOKEN", "Token is invalid or expired");
	}

	return row;
}

async function consumeToken(
	tokenId: string,
	email: string,
	purpose: EmailTokenPurpose,
) {
	const normalizedEmail = normalizeEmail(email);
	await prisma.emailVerificationToken.deleteMany({
		where: {
			purpose,
			OR: [{ id: tokenId }, { email: normalizedEmail }],
		},
	});
	// Remove this token plus any same-purpose tokens for the normalized address.
}

// ── Email templates ─────────────────────────────────────────────────────────

function buildVerificationHtml(
	appTitle: string,
	heading: string,
	bodyText: string,
	ctaLabel: string,
	ctaUrl: string,
) {
	const accentColor = "#2C6E91";
	const safeTitle = escapeHtml(appTitle);
	const safeLabel = escapeHtml(ctaLabel);
	const safeUrl = escapeHtml(ctaUrl);

	return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#faf7f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf7f2;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#fffdf8;border-radius:8px;overflow:hidden;border:1px solid #e8e2d8;">
        <tr><td style="height:4px;background-color:${accentColor};"></td></tr>
        <tr><td style="padding:24px 32px 16px;">
          <p style="margin:0;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#8a8078;">${safeTitle}</p>
        </td></tr>
        <tr><td style="padding:0 32px 24px;">
          <h2 style="margin:0 0 12px;font-size:18px;font-weight:600;color:#2c2825;">${escapeHtml(heading)}</h2>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#2c2825;">${bodyText}</p>
        </td></tr>
        <tr><td style="padding:0 32px 32px;" align="center">
          <a href="${safeUrl}" style="display:inline-block;padding:10px 28px;background-color:${accentColor};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:6px;">${safeLabel}</a>
        </td></tr>
        <tr><td style="padding:0 32px 24px;">
          <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#6b625c;">如果按钮无法点击，请复制下面的链接到浏览器打开：</p>
          <p style="margin:0;font-size:12px;line-height:1.6;word-break:break-all;"><a href="${safeUrl}" style="color:#2C6E91;text-decoration:underline;">${safeUrl}</a></p>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #e8e2d8;">
          <p style="margin:0;font-size:12px;color:#c0b8ad;text-align:center;">
            你收到这封邮件是因为 ${safeTitle} 账户触发了安全操作请求。链接将在 1 小时后失效；如果不是你本人操作，可忽略本邮件。
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildNotificationHtml(
	appTitle: string,
	heading: string,
	bodyText: string,
) {
	const accentColor = "#2C6E91";
	const safeTitle = escapeHtml(appTitle);

	return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#faf7f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf7f2;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#fffdf8;border-radius:8px;overflow:hidden;border:1px solid #e8e2d8;">
        <tr><td style="height:4px;background-color:${accentColor};"></td></tr>
        <tr><td style="padding:24px 32px 16px;">
          <p style="margin:0;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#8a8078;">${safeTitle}</p>
        </td></tr>
        <tr><td style="padding:0 32px 24px;">
          <h2 style="margin:0 0 12px;font-size:18px;font-weight:600;color:#2c2825;">${escapeHtml(heading)}</h2>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#2c2825;">${bodyText}</p>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #e8e2d8;">
          <p style="margin:0;font-size:12px;color:#c0b8ad;text-align:center;">
            你收到这封邮件是因为 ${safeTitle} 账户发生了安全相关变更。
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function maskEmailForNotification(email: string) {
	const normalizedEmail = normalizeEmail(email);
	const [localPart, domain] = normalizedEmail.split("@");

	if (!localPart || !domain) {
		return "***";
	}

	if (localPart.length <= 2) {
		return `${localPart[0]}***@${domain}`;
	}

	return `${localPart[0]}***${localPart[localPart.length - 1]}@${domain}`;
}

// ── Registration flow ───────────────────────────────────────────────────────

export async function sendRegistrationEmail(email: string) {
	const normalizedEmail = normalizeEmail(email);
	const registrationAttempts = await countRecentVerificationTokens(
		normalizedEmail,
		EmailTokenPurpose.REGISTRATION,
	);

	if (registrationAttempts >= RATE_LIMIT_MAX) {
		return;
	}

	const registrationToken = await createVerificationTokenWithoutRateLimit(
		normalizedEmail,
		EmailTokenPurpose.REGISTRATION,
	);
	const existing = await prisma.user.findUnique({
		where: { email: normalizedEmail },
	});
	if (existing) {
		if (existing.isActive) {
			await sendExistingAccountEmail(normalizedEmail, existing.id);
		}
		return;
	}

	await sendNewRegistrationEmail(normalizedEmail, registrationToken);
}

async function sendNewRegistrationEmail(email: string, token: string) {
	const baseUrl =
		(await getConfigValue("app.base_url")) || "http://localhost:3000";
	const appTitle = await getAppTitle();
	const verifyUrl = `${baseUrl}/register/complete?token=${token}`;

	const subject = `[${appTitle}] 请验证你的邮箱`;
	const text = `你收到这封邮件，是因为有人使用此邮箱发起了 ${appTitle} 注册。\n\n请打开以下链接完成邮箱验证：\n${verifyUrl}\n\n出于安全考虑，该链接 1 小时内有效。若非本人操作，可忽略本邮件。`;
	const html = buildVerificationHtml(
		appTitle,
		"验证你的邮箱",
		`我们收到了使用此邮箱注册 ${escapeHtml(appTitle)} 账户的请求。请点击下方按钮继续。`,
		"立即验证邮箱",
		verifyUrl,
	);

	try {
		await sendEmail(email, subject, text, html);
	} catch (error) {
		rootLogger.warn({ err: error }, "registration_email_failed");
	}
}

async function sendExistingAccountEmail(email: string, userId: string) {
	const token = await createVerificationTokenWithoutRateLimit(
		email,
		EmailTokenPurpose.PASSWORD_RESET,
		userId,
	);
	const baseUrl =
		(await getConfigValue("app.base_url")) || "http://localhost:3000";
	const appTitle = await getAppTitle();
	const resetUrl = `${baseUrl}/reset-password?token=${token}`;

	const subject = `您的 ${appTitle} 账号已存在`;
	const text = `你收到这封邮件，是因为有人尝试使用此邮箱注册 ${appTitle} 账号。\n\n该邮箱已经有一个 ${appTitle} 账号。如果你忘记密码，可以使用下面的链接重置密码，或在页面上选择使用一次性链接直接登录：\n${resetUrl}\n\n出于安全考虑，该链接 1 小时内有效。若非本人操作，可忽略本邮件。`;
	const html = buildVerificationHtml(
		appTitle,
		"账号已存在",
		`该邮箱已经有一个 ${escapeHtml(appTitle)} 账号。如果你忘记密码，可以使用下方链接重置密码，或在页面上选择使用一次性链接直接登录。`,
		"前往账号恢复",
		resetUrl,
	);

	try {
		await sendEmail(email, subject, text, html);
	} catch (error) {
		rootLogger.warn(
			{ err: error },
			"existing_account_registration_email_failed",
		);
	}
}

export async function verifyRegistrationToken(token: string) {
	const row = await validateToken(token, EmailTokenPurpose.REGISTRATION);

	// Check email hasn't been taken while token was pending
	const existing = await prisma.user.findUnique({
		where: { email: row.email },
	});
	if (existing) {
		throw invalidRegistrationTokenError();
	}

	return { valid: true, email: row.email };
}

export async function completeRegistration(
	token: string,
	input: Omit<RegisterInput, "email">,
	sessionMeta: SessionMetadata,
) {
	const row = await validateToken(token, EmailTokenPurpose.REGISTRATION);
	const existing = await prisma.user.findUnique({
		where: { email: row.email },
	});
	if (existing) {
		throw invalidRegistrationTokenError();
	}

	let result: Awaited<ReturnType<typeof createUserWithPersonalClass>>;
	try {
		result = await createUserWithPersonalClass(
			{
				email: row.email,
				...input,
			},
			sessionMeta,
		);
	} catch (error) {
		if (
			(error instanceof AppError && error.code === "EMAIL_EXISTS") ||
			isPrismaUniqueError(error)
		) {
			throw invalidRegistrationTokenError();
		}
		throw error;
	}

	await consumeToken(row.id, row.email, EmailTokenPurpose.REGISTRATION);

	return result;
}

// ── Password reset flow ─────────────────────────────────────────────────────

export async function sendPasswordResetEmail(email: string) {
	const normalizedEmail = normalizeEmail(email);
	const user = await prisma.user.findUnique({
		where: { email: normalizedEmail },
	});

	// Silent return — do not reveal whether email exists
	if (!user || !user.isActive) {
		return;
	}

	const token = await createVerificationToken(
		normalizedEmail,
		EmailTokenPurpose.PASSWORD_RESET,
		user.id,
	);
	const baseUrl =
		(await getConfigValue("app.base_url")) || "http://localhost:3000";
	const appTitle = await getAppTitle();
	const resetUrl = `${baseUrl}/reset-password?token=${token}`;

	const subject = `[${appTitle}] 重置你的密码`;
	const text = `你收到这封邮件，是因为你的 ${appTitle} 账户发起了密码重置请求。\n\n请打开以下链接设置新密码：\n${resetUrl}\n\n出于安全考虑，该链接 1 小时内有效。若非本人操作，可忽略本邮件。`;
	const html = buildVerificationHtml(
		appTitle,
		"重置密码",
		`我们收到了你的 ${escapeHtml(appTitle)} 账户密码重置请求。请点击下方按钮设置新密码。`,
		"设置新密码",
		resetUrl,
	);

	await sendEmail(normalizedEmail, subject, text, html);
}

export async function verifyPasswordResetToken(token: string) {
	const row = await validateToken(token, EmailTokenPurpose.PASSWORD_RESET);
	return { valid: true, email: row.email };
}

export async function resetPassword(token: string, newPassword: string) {
	const row = await validateToken(token, EmailTokenPurpose.PASSWORD_RESET);

	if (!row.userId) {
		throw new AppError(400, "INVALID_TOKEN", "Token is invalid");
	}

	const user = await prisma.user.findUnique({
		where: { id: row.userId },
		include: { school: { select: { name: true } } },
	});

	if (!user) {
		throw new AppError(400, "INVALID_TOKEN", "User not found");
	}

	if (!user.isActive) {
		throw new AppError(403, "USER_INACTIVE", "Account is disabled");
	}

	const passwordHash = await hashPassword(newPassword);

	await prisma.userCredential.upsert({
		where: {
			userId_provider: {
				userId: row.userId,
				provider: AuthProvider.LOCAL,
			},
		},
		create: {
			userId: row.userId,
			provider: AuthProvider.LOCAL,
			passwordHash,
		},
		update: { passwordHash },
	});

	// Kill all existing browser sessions for this user, then create a fresh
	// untrusted browser session to auto-login after successful reset.
	await revokeAllBrowserSessions(row.userId);
	const { token: sessionToken, session } = await createBrowserSession({
		userId: row.userId,
		isTrusted: false,
		userAgent: null,
		ipAddress: null,
	});
	await cacheSessionByToken(sessionToken, session, user);

	await consumeToken(row.id, row.email, EmailTokenPurpose.PASSWORD_RESET);

	return {
		message: "Password reset successfully.",
		token: sessionToken,
		user: toUserProfile(user),
	};
}

export async function signInWithPasswordResetToken(
	token: string,
	sessionMeta: SessionMetadata,
) {
	const row = await validateToken(token, EmailTokenPurpose.PASSWORD_RESET);

	if (!row.userId) {
		throw new AppError(400, "INVALID_TOKEN", "Token is invalid");
	}

	const user = await prisma.user.findUnique({
		where: { id: row.userId },
		include: { school: { select: { name: true } } },
	});

	if (!user) {
		throw new AppError(400, "INVALID_TOKEN", "User not found");
	}

	if (!user.isActive) {
		throw new AppError(403, "USER_INACTIVE", "Account is disabled");
	}

	const { token: sessionToken, session } = await createBrowserSession({
		userId: row.userId,
		isTrusted: false,
		userAgent: sessionMeta.userAgent,
		ipAddress: sessionMeta.ipAddress,
	});
	await cacheSessionByToken(sessionToken, session, user);

	await consumeToken(row.id, row.email, EmailTokenPurpose.PASSWORD_RESET);

	return {
		message: "Signed in successfully.",
		token: sessionToken,
		user: toUserProfile(user),
	};
}

// ── Email change flow ───────────────────────────────────────────────────────

export async function sendEmailChangeVerification(
	userId: string,
	newEmail: string,
) {
	const normalizedEmail = normalizeEmail(newEmail);
	const attempts = await countRecentVerificationTokens(
		normalizedEmail,
		EmailTokenPurpose.EMAIL_CHANGE,
	);

	if (attempts >= RATE_LIMIT_MAX) {
		return;
	}

	const token = await createVerificationTokenWithoutRateLimit(
		normalizedEmail,
		EmailTokenPurpose.EMAIL_CHANGE,
		userId,
	);
	const baseUrl =
		(await getConfigValue("app.base_url")) || "http://localhost:3000";
	const appTitle = await getAppTitle();
	const confirmUrl = `${baseUrl}/settings/verify-email?token=${token}`;

	const subject = `[${appTitle}] 确认你的新邮箱`;
	const text = `你收到这封邮件，是因为有人正在尝试将一个 ${appTitle} 账号的邮箱修改为本邮箱（${normalizedEmail}）。\n\n如果这是你本人操作，请打开以下链接确认改绑：\n${confirmUrl}\n\n确认前，该账号仍会继续使用原邮箱。出于安全考虑，该链接 1 小时内有效。若非本人操作，可忽略本邮件。`;
	const html = buildVerificationHtml(
		appTitle,
		"确认新邮箱",
		`我们收到请求：将一个 ${escapeHtml(appTitle)} 账号的邮箱修改为本邮箱（<strong>${escapeHtml(normalizedEmail)}</strong>）。如果这是你本人操作，请点击下方按钮确认。确认前，该账号仍会继续使用原邮箱。`,
		"确认邮箱修改",
		confirmUrl,
	);

	await sendEmail(normalizedEmail, subject, text, html);
}

async function sendEmailChangeSuccessNotification(
	oldEmail: string,
	newEmail: string,
) {
	const appTitle = await getAppTitle();
	const maskedNewEmail = maskEmailForNotification(newEmail);
	const subject = `[${appTitle}] 你的邮箱已修改`;
	const text = `你的 ${appTitle} 账号邮箱已成功修改为 ${maskedNewEmail}。\n\n如果这不是你本人操作，请立即联系支持团队。`;
	const html = buildNotificationHtml(
		appTitle,
		"邮箱已修改",
		`你的 ${escapeHtml(appTitle)} 账号邮箱已成功修改为 <strong>${escapeHtml(maskedNewEmail)}</strong>。<br><br>如果这不是你本人操作，请立即联系支持团队。`,
	);

	try {
		await sendEmail(oldEmail, subject, text, html);
	} catch (error) {
		rootLogger.warn({ err: error }, "email_change_success_notification_failed");
	}
}

export async function confirmEmailChange(
	token: string,
	authenticatedUserId: string,
) {
	const row = await validateToken(token, EmailTokenPurpose.EMAIL_CHANGE);
	const email = normalizeEmail(row.email);

	// Check email still available (race condition guard)
	const existing = await prisma.user.findUnique({
		where: { email },
		include: { school: { select: { name: true } } },
	});
	if (existing && existing.id !== row.userId) {
		await consumeToken(row.id, email, EmailTokenPurpose.EMAIL_CHANGE);
		throw new AppError(
			409,
			"EMAIL_BOUND_TO_OTHER_ACCOUNT",
			"This email is already bound to another account",
		);
	}

	if (!row.userId || row.userId !== authenticatedUserId) {
		throw new AppError(
			403,
			"FORBIDDEN",
			"Token does not match authenticated user",
		);
	}

	if (existing) {
		await consumeToken(row.id, email, EmailTokenPurpose.EMAIL_CHANGE);
		await cacheDel(cacheKeys.userProfile(row.userId));
		return toUserProfile(existing, null);
	}

	const previousUser = await prisma.user.findUniqueOrThrow({
		where: { id: row.userId },
		select: { email: true },
	});

	const user = await prisma.user.update({
		where: { id: row.userId },
		data: { email },
		include: { school: { select: { name: true } } },
	});

	await consumeToken(row.id, email, EmailTokenPurpose.EMAIL_CHANGE);
	await cacheDel(cacheKeys.userProfile(row.userId));
	await sendEmailChangeSuccessNotification(previousUser.email, email);

	return toUserProfile(user, null);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
