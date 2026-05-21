import { randomBytes } from "node:crypto";

import { AuthProvider, EmailTokenPurpose, prisma } from "@taskflow/db";

import { cacheDel, cacheKeys } from "../lib/cache.js";
import { normalizeEmail } from "../lib/email.js";
import {
	renderEmailChangeSuccessEmail,
	renderEmailChangeVerificationEmail,
	renderExistingAccountEmail,
	renderPasswordResetEmail,
	renderRegistrationVerificationEmail,
} from "../lib/email-templates.js";
import { AppError } from "../lib/errors.js";
import { toUserProfile } from "../lib/http.js";
import { type AppLocale, normalizeLocale } from "../lib/locale.js";
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

export async function sendRegistrationEmail(email: string, locale: AppLocale) {
	const normalizedEmail = normalizeEmail(email);
	const requestedLocale = normalizeLocale(locale);
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
		select: { id: true, isActive: true, locale: true },
	});
	if (existing) {
		if (existing.isActive) {
			await sendExistingAccountEmail(
				normalizedEmail,
				existing.id,
				normalizeLocale(existing.locale),
			);
		}
		return;
	}

	await sendNewRegistrationEmail(
		normalizedEmail,
		registrationToken,
		requestedLocale,
	);
}

async function sendNewRegistrationEmail(
	email: string,
	token: string,
	locale: AppLocale,
) {
	const baseUrl =
		(await getConfigValue("app.base_url")) || "http://localhost:3000";
	const appTitle = await getAppTitle();
	const verifyUrl = `${baseUrl}/register/complete?token=${token}`;
	const rendered = renderRegistrationVerificationEmail(locale, {
		appTitle,
		url: verifyUrl,
	});

	try {
		await sendEmail(email, rendered.subject, rendered.text, rendered.html);
	} catch (error) {
		rootLogger.warn({ err: error }, "registration_email_failed");
	}
}

async function sendExistingAccountEmail(
	email: string,
	userId: string,
	locale: AppLocale,
) {
	const token = await createVerificationTokenWithoutRateLimit(
		email,
		EmailTokenPurpose.PASSWORD_RESET,
		userId,
	);
	const baseUrl =
		(await getConfigValue("app.base_url")) || "http://localhost:3000";
	const appTitle = await getAppTitle();
	const resetUrl = `${baseUrl}/reset-password?token=${token}`;
	const rendered = renderExistingAccountEmail(locale, {
		appTitle,
		url: resetUrl,
	});

	try {
		await sendEmail(email, rendered.subject, rendered.text, rendered.html);
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

export async function sendPasswordResetEmail(
	email: string,
	requestedLocale: AppLocale,
) {
	const normalizedEmail = normalizeEmail(email);
	const user = await prisma.user.findUnique({
		where: { email: normalizedEmail },
		select: { id: true, isActive: true, locale: true },
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
	const rendered = renderPasswordResetEmail(
		normalizeLocale(user.locale ?? requestedLocale),
		{
			appTitle,
			url: resetUrl,
		},
	);

	await sendEmail(
		normalizedEmail,
		rendered.subject,
		rendered.text,
		rendered.html,
	);
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
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { locale: true },
	});
	const rendered = renderEmailChangeVerificationEmail(
		normalizeLocale(user?.locale),
		{
			appTitle,
			url: confirmUrl,
			email: normalizedEmail,
		},
	);

	await sendEmail(
		normalizedEmail,
		rendered.subject,
		rendered.text,
		rendered.html,
	);
}

async function sendEmailChangeSuccessNotification(
	oldEmail: string,
	newEmail: string,
	locale: AppLocale,
) {
	const appTitle = await getAppTitle();
	const maskedNewEmail = maskEmailForNotification(newEmail);
	const rendered = renderEmailChangeSuccessEmail(locale, {
		appTitle,
		maskedNewEmail,
	});

	try {
		await sendEmail(oldEmail, rendered.subject, rendered.text, rendered.html);
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
		select: { email: true, locale: true },
	});

	const user = await prisma.user.update({
		where: { id: row.userId },
		data: { email },
		include: { school: { select: { name: true } } },
	});

	await consumeToken(row.id, email, EmailTokenPurpose.EMAIL_CHANGE);
	await cacheDel(cacheKeys.userProfile(row.userId));
	await sendEmailChangeSuccessNotification(
		previousUser.email,
		email,
		normalizeLocale(previousUser.locale),
	);

	return toUserProfile(user, null);
}
