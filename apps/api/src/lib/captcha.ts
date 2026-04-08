import { AppError } from "./errors.js";

interface CapSiteVerifyResponse {
	success: boolean;
}

export function isCaptchaEnabled(): boolean {
	return process.env.CAP_ENABLED === "true";
}

export async function verifyCaptcha(token: string | undefined): Promise<void> {
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

	const capUrl = process.env.CAP_URL;
	const capSecret = process.env.CAP_SECRET;

	if (!capUrl || !capSecret) {
		throw new AppError(
			503,
			"CAPTCHA_UNAVAILABLE",
			"CAPTCHA service is not configured",
		);
	}

	let response: Response;
	try {
		response = await fetch(`${capUrl}/siteverify`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ secret: capSecret, response: token }),
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

	const result = (await response.json()) as CapSiteVerifyResponse;

	if (!result.success) {
		throw new AppError(403, "CAPTCHA_FAILED", "CAPTCHA verification failed");
	}
}
