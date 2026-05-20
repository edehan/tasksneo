import { afterEach, describe, expect, it, vi } from "vitest";
import { isCaptchaEnabled, verifyCaptcha } from "../lib/captcha.js";
import { AppError } from "../lib/errors.js";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

function resetEnv() {
	process.env = { ...originalEnv };
	globalThis.fetch = originalFetch;
}

function mockFetch(response: unknown, init: ResponseInit = {}) {
	const fetchMock = vi.fn(async () => {
		return new Response(JSON.stringify(response), {
			status: 200,
			headers: { "Content-Type": "application/json" },
			...init,
		});
	});
	globalThis.fetch = fetchMock as typeof fetch;
	return fetchMock;
}

async function expectAppError(
	promise: Promise<void>,
	code: string,
	status: number,
) {
	let caught: unknown;
	try {
		await promise;
	} catch (error) {
		caught = error;
	}

	expect(caught).toBeInstanceOf(AppError);
	expect((caught as AppError).code).toBe(code);
	expect((caught as AppError).status).toBe(status);
}

describe("Turnstile CAPTCHA verification", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		resetEnv();
	});

	it("skips verification when Turnstile is disabled", async () => {
		process.env.TURNSTILE_ENABLED = "false";
		const fetchMock = vi.fn();
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		await verifyCaptcha(undefined, "register", "203.0.113.10");

		expect(isCaptchaEnabled()).toBe(false);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("requires a token when Turnstile is enabled", async () => {
		process.env.TURNSTILE_ENABLED = "true";
		process.env.TURNSTILE_SECRET_KEY = "secret";

		await expectAppError(
			verifyCaptcha(undefined, "register", "203.0.113.10"),
			"CAPTCHA_REQUIRED",
			400,
		);
	});

	it("requires a secret key when Turnstile is enabled", async () => {
		process.env.TURNSTILE_ENABLED = "true";
		delete process.env.TURNSTILE_SECRET_KEY;

		await expectAppError(
			verifyCaptcha("token", "register", "203.0.113.10"),
			"CAPTCHA_UNAVAILABLE",
			503,
		);
	});

	it("accepts a successful Siteverify response for the expected action", async () => {
		process.env.TURNSTILE_ENABLED = "true";
		process.env.TURNSTILE_SECRET_KEY = "secret";
		const fetchMock = mockFetch({ success: true, action: "register" });

		await verifyCaptcha("token", "register", "203.0.113.10");

		expect(fetchMock).toHaveBeenCalledWith(
			"https://challenges.cloudflare.com/turnstile/v0/siteverify",
			expect.objectContaining({
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					secret: "secret",
					response: "token",
					remoteip: "203.0.113.10",
				}),
			}),
		);
	});

	it("rejects failed Siteverify responses", async () => {
		process.env.TURNSTILE_ENABLED = "true";
		process.env.TURNSTILE_SECRET_KEY = "secret";
		mockFetch({ success: false, "error-codes": ["invalid-input-response"] });

		await expectAppError(
			verifyCaptcha("token", "register", "203.0.113.10"),
			"CAPTCHA_FAILED",
			403,
		);
	});

	it("rejects Siteverify responses for a different action", async () => {
		process.env.TURNSTILE_ENABLED = "true";
		process.env.TURNSTILE_SECRET_KEY = "secret";
		mockFetch({ success: true, action: "email_change" });

		await expectAppError(
			verifyCaptcha("token", "register", "203.0.113.10"),
			"CAPTCHA_FAILED",
			403,
		);
	});

	it("treats non-2xx Siteverify responses as unavailable", async () => {
		process.env.TURNSTILE_ENABLED = "true";
		process.env.TURNSTILE_SECRET_KEY = "secret";
		mockFetch({ success: false }, { status: 502 });

		await expectAppError(
			verifyCaptcha("token", "register", "203.0.113.10"),
			"CAPTCHA_UNAVAILABLE",
			503,
		);
	});

	it("treats Siteverify network errors as unavailable", async () => {
		process.env.TURNSTILE_ENABLED = "true";
		process.env.TURNSTILE_SECRET_KEY = "secret";
		globalThis.fetch = vi.fn(async () => {
			throw new Error("network down");
		}) as unknown as typeof fetch;

		await expectAppError(
			verifyCaptcha("token", "register", "203.0.113.10"),
			"CAPTCHA_UNAVAILABLE",
			503,
		);
	});
});
