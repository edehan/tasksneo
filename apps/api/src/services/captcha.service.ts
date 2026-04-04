import { randomBytes } from "node:crypto";

import jwt, { type JwtPayload } from "jsonwebtoken";

import { loadEnv } from "../lib/env.js";
import { AppError } from "../lib/errors.js";
import { getRedisClient } from "../lib/redis.js";

export type CaptchaPurpose = "REGISTRATION" | "PASSWORD_RESET" | "EMAIL_CHANGE";

interface VerifyCaptchaAndIssueProofInput {
	email: string;
	purpose: CaptchaPurpose;
	captchaToken: string;
	userId?: string;
	remoteIp?: string;
	requestOrigin?: string;
}

interface ConsumeCaptchaProofInput {
	email: string;
	purpose: CaptchaPurpose;
	captchaProof?: string;
	userId?: string;
}

interface CaptchaSiteverifyResponse {
	success?: boolean;
}

interface CaptchaProofPayload extends JwtPayload {
	type: "CAPTCHA_PROOF";
	purpose: CaptchaPurpose;
	email: string;
	userId?: string;
	nonce: string;
}

function getCaptchaNonceKey(nonce: string) {
	return `captcha:proof:nonce:${nonce}`;
}

function normalizeEmail(email: string) {
	return email.trim().toLowerCase();
}

function parseRemoteIpHeader(forwardedFor: string | undefined) {
	if (!forwardedFor) return undefined;
	const first = forwardedFor.split(",")[0]?.trim();
	return first || undefined;
}

export function getRequestRemoteIp(headers: {
	xForwardedFor?: string;
	xRealIp?: string;
	cfConnectingIp?: string;
}) {
	return (
		parseRemoteIpHeader(headers.xForwardedFor) ??
		headers.xRealIp?.trim() ??
		headers.cfConnectingIp?.trim() ??
		undefined
	);
}

export function getRequestOrigin(headers: {
	xForwardedProto?: string;
	xForwardedHost?: string;
	host?: string;
}) {
	const protocol = headers.xForwardedProto?.split(",")[0]?.trim() || "https";
	const host = headers.xForwardedHost?.split(",")[0]?.trim() || headers.host?.trim();

	if (!host) {
		return undefined;
	}

	return `${protocol}://${host}`;
}

export function isCaptchaEnabled() {
	return loadEnv().captchaEnabled;
}

function resolveCaptchaVerifyUrl(requestOrigin?: string) {
	const env = loadEnv();

	if (env.captchaVerifyUrlOverride) {
		return env.captchaVerifyUrlOverride;
	}

	if (!requestOrigin) {
		throw new AppError(
			503,
			"CAPTCHA_UNAVAILABLE",
			"Cannot resolve captcha verification endpoint",
		);
	}

	return `${requestOrigin.replace(/\/+$/, "")}/cap/siteverify`;
}

async function assertCaptchaTokenValid(input: {
	captchaToken: string;
	remoteIp?: string;
	requestOrigin?: string;
}) {
	const env = loadEnv();

	if (!env.captchaEnabled) {
		throw new AppError(503, "CAPTCHA_DISABLED", "Captcha is disabled");
	}

	const response = await fetch(resolveCaptchaVerifyUrl(input.requestOrigin), {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			secret: env.captchaSecret,
			response: input.captchaToken,
			...(input.remoteIp ? { remoteip: input.remoteIp } : {}),
		}),
	});

	if (!response.ok) {
		throw new AppError(
			503,
			"CAPTCHA_UNAVAILABLE",
			"Captcha verification service is unavailable",
		);
	}

	const data = (await response.json()) as CaptchaSiteverifyResponse;

	if (!data.success) {
		throw new AppError(400, "CAPTCHA_INVALID", "Captcha validation failed");
	}
}

async function issueCaptchaProof(input: {
	email: string;
	purpose: CaptchaPurpose;
	userId?: string;
}) {
	const env = loadEnv();
	const nonce = randomBytes(16).toString("hex");
	const payload: CaptchaProofPayload = {
		type: "CAPTCHA_PROOF",
		purpose: input.purpose,
		email: normalizeEmail(input.email),
		nonce,
		...(input.userId ? { userId: input.userId } : {}),
	};
	const token = jwt.sign(payload, env.captchaProofSecret, {
		expiresIn: env.captchaProofTtlSeconds,
	});

	try {
		const redis = getRedisClient();
		await redis.set(
			getCaptchaNonceKey(nonce),
			"1",
			"EX",
			env.captchaProofTtlSeconds,
		);
	} catch {
		throw new AppError(
			503,
			"CAPTCHA_UNAVAILABLE",
			"Captcha verification storage is unavailable",
		);
	}

	return token;
}

function decodeCaptchaProof(captchaProof: string): CaptchaProofPayload {
	const env = loadEnv();
	let payload: string | JwtPayload;

	try {
		payload = jwt.verify(captchaProof, env.captchaProofSecret);
	} catch {
		throw new AppError(400, "CAPTCHA_INVALID", "Captcha proof is invalid");
	}

	if (typeof payload === "string") {
		throw new AppError(400, "CAPTCHA_INVALID", "Captcha proof is invalid");
	}

	const typedPayload = payload as Partial<CaptchaProofPayload>;

	if (
		typedPayload.type !== "CAPTCHA_PROOF" ||
		!typedPayload.purpose ||
		!typedPayload.email ||
		!typedPayload.nonce
	) {
		throw new AppError(400, "CAPTCHA_INVALID", "Captcha proof is invalid");
	}

	return typedPayload as CaptchaProofPayload;
}

export async function verifyCaptchaAndIssueProof(
	input: VerifyCaptchaAndIssueProofInput,
) {
	await assertCaptchaTokenValid({
		captchaToken: input.captchaToken,
		remoteIp: input.remoteIp,
		requestOrigin: input.requestOrigin,
	});

	return {
		captchaProof: await issueCaptchaProof({
			email: input.email,
			purpose: input.purpose,
			userId: input.userId,
		}),
	};
}

export async function assertAndConsumeCaptchaProof(
	input: ConsumeCaptchaProofInput,
) {
	if (!isCaptchaEnabled()) {
		return;
	}

	if (!input.captchaProof) {
		throw new AppError(400, "CAPTCHA_REQUIRED", "Captcha proof is required");
	}

	const payload = decodeCaptchaProof(input.captchaProof);

	if (payload.purpose !== input.purpose) {
		throw new AppError(
			400,
			"CAPTCHA_PURPOSE_MISMATCH",
			"Captcha proof does not match request purpose",
		);
	}

	if (payload.email !== normalizeEmail(input.email)) {
		throw new AppError(
			400,
			"CAPTCHA_EMAIL_MISMATCH",
			"Captcha proof does not match request email",
		);
	}

	if ((payload.userId ?? null) !== (input.userId ?? null)) {
		throw new AppError(
			403,
			"CAPTCHA_USER_MISMATCH",
			"Captcha proof does not match authenticated user",
		);
	}

	try {
		const redis = getRedisClient();
		const consumed = await redis.del(getCaptchaNonceKey(payload.nonce));

		if (!consumed) {
			throw new AppError(
				400,
				"CAPTCHA_REPLAYED",
				"Captcha proof has expired or already been used",
			);
		}
	} catch (err) {
		if (err instanceof AppError) {
			throw err;
		}

		throw new AppError(
			503,
			"CAPTCHA_UNAVAILABLE",
			"Captcha verification storage is unavailable",
		);
	}
}
