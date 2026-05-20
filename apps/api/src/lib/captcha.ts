import { AppError } from "./errors.js";

const TURNSTILE_SITEVERIFY_URL =
	"https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type CaptchaAction = "register" | "email_change";

interface TurnstileSiteVerifyResponse {
	success: boolean;
	action?: string;
	"error-codes"?: string[];
}

export function isCaptchaEnabled(): boolean {
	return process.env.TURNSTILE_ENABLED === "true";
}

export async function verifyCaptcha(
	token: string | undefined,
	action: CaptchaAction,
	remoteIp?: string | null,
): Promise<void> {
	if (!isCaptchaEnabled()) {
		return;
	}

	if (!token) {
		throw new AppError(
			400,
			"CAPTCHA_REQUIRED",
			"CAPTCHA verification is required",
		);
	}

	const secret = process.env.TURNSTILE_SECRET_KEY;

	if (!secret) {
		throw new AppError(
			503,
			"CAPTCHA_UNAVAILABLE",
			"CAPTCHA service is not configured",
		);
	}

	let response: Response;
	try {
		response = await fetch(TURNSTILE_SITEVERIFY_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				secret,
				response: token,
				...(remoteIp ? { remoteip: remoteIp } : {}),
			}),
		});
	} catch {
		throw new AppError(
			503,
			"CAPTCHA_UNAVAILABLE",
			"CAPTCHA service is unavailable",
		);
	}

	if (!response.ok) {
		throw new AppError(
			503,
			"CAPTCHA_UNAVAILABLE",
			"CAPTCHA service is unavailable",
		);
	}

	let result: TurnstileSiteVerifyResponse;
	try {
		result = (await response.json()) as TurnstileSiteVerifyResponse;
	} catch {
		throw new AppError(
			503,
			"CAPTCHA_UNAVAILABLE",
			"CAPTCHA service is unavailable",
		);
	}

	if (!result.success || (result.action && result.action !== action)) {
		throw new AppError(403, "CAPTCHA_FAILED", "CAPTCHA verification failed");
	}
}
