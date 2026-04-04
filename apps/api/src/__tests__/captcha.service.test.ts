import "./test-helpers.js";

import { beforeEach, describe, expect, it, vi } from "vitest";

const redisStore = new Map<string, string>();

const mockRedis = {
	async set(key: string, value: string) {
		redisStore.set(key, value);
		return "OK";
	},
	async del(key: string) {
		const existed = redisStore.delete(key);
		return existed ? 1 : 0;
	},
};

vi.mock("../lib/redis.js", () => ({
	getRedisClient: () => mockRedis,
}));

import {
	assertAndConsumeCaptchaProof,
	verifyCaptchaAndIssueProof,
} from "../services/captcha.service.js";

describe("captcha.service", () => {
	beforeEach(() => {
		redisStore.clear();
		vi.restoreAllMocks();
		process.env.CAPTCHA_ENABLED = "true";
		process.env.CAPTCHA_VERIFY_URL = "http://cap.test/siteverify";
		process.env.CAPTCHA_SECRET = "cap-secret";
		process.env.CAPTCHA_PROOF_SECRET = "cap-proof-secret";
		process.env.CAPTCHA_PROOF_TTL_SECONDS = "300";
	});

	it("issues one-time captcha proof and consumes it once", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const { captchaProof } = await verifyCaptchaAndIssueProof({
			email: "User@example.com",
			purpose: "REGISTRATION",
			captchaToken: "token-1",
		});

		await expect(
			assertAndConsumeCaptchaProof({
				email: "user@example.com",
				purpose: "REGISTRATION",
				captchaProof,
			}),
		).resolves.toBeUndefined();

		await expect(
			assertAndConsumeCaptchaProof({
				email: "user@example.com",
				purpose: "REGISTRATION",
				captchaProof,
			}),
		).rejects.toMatchObject({ code: "CAPTCHA_REPLAYED" });
	});

	it("rejects proof when bound email does not match", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const { captchaProof } = await verifyCaptchaAndIssueProof({
			email: "owner@example.com",
			purpose: "PASSWORD_RESET",
			captchaToken: "token-2",
		});

		await expect(
			assertAndConsumeCaptchaProof({
				email: "other@example.com",
				purpose: "PASSWORD_RESET",
				captchaProof,
			}),
		).rejects.toMatchObject({ code: "CAPTCHA_EMAIL_MISMATCH" });
	});

	it("skips captcha proof checks when captcha is disabled", async () => {
		process.env.CAPTCHA_ENABLED = "false";

		await expect(
			assertAndConsumeCaptchaProof({
				email: "any@example.com",
				purpose: "REGISTRATION",
			}),
		).resolves.toBeUndefined();
	});
});
