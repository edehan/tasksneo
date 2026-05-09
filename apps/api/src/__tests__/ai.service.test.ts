import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetConfigValues } = vi.hoisted(() => ({
	mockGetConfigValues: vi.fn(),
}));

vi.mock("../services/system-config.service.js", () => ({
	getConfigValues: mockGetConfigValues,
}));

const { parseTaskContent } = await import("../services/ai.service.js");

function mockLlmResponse(payload: unknown) {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => ({
			ok: true,
			json: async () => ({
				content: [{ type: "text", text: JSON.stringify(payload) }],
			}),
		})),
	);
}

describe("AI task parsing", () => {
	beforeEach(() => {
		mockGetConfigValues.mockResolvedValue(
			new Map([
				["llm.provider", "anthropic"],
				["llm.base_url", "https://llm.test"],
				["llm.api_key", "test-key"],
				["llm.model", "test-model"],
				["llm.prompt_task_parse", ""],
			]),
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	it("cleans each parsed time option independently", async () => {
		mockLlmResponse({
			title: "Math homework",
			timeOptions: [
				{
					startAt: "2026-04-10T09:00:00+08:00",
					dueAt: null,
				},
				{
					startAt: "2026-04-10T17:00:00+08:00",
					dueAt: "2026-04-10T17:00:00+08:00",
				},
				{
					startAt: "2026-04-11T09:00:00+08:00",
					dueAt: "2026-04-10T17:00:00+08:00",
				},
			],
			allowLateSubmission: null,
			description: "Finish the math homework.",
			markdown: "# Math homework",
		});

		const result = await parseTaskContent({
			text: "Math homework",
			context: {
				userTimezone: "Asia/Singapore",
				localNowWithWeekday: "2026-04-09 10:00:00 (Thursday, GMT+8)",
			},
		});

		expect(result.structured.timeOptions).toEqual([
			{
				startAt: "2026-04-10T09:00:00+08:00",
				dueAt: null,
			},
			{
				startAt: null,
				dueAt: "2026-04-10T17:00:00+08:00",
			},
			{
				startAt: null,
				dueAt: null,
			},
		]);
	});

	it("preserves due-only and valid start-before-due options", async () => {
		mockLlmResponse({
			title: "Science report",
			timeOptions: [
				{
					startAt: null,
					dueAt: "2026-04-10T17:00:00+08:00",
				},
				{
					startAt: "2026-04-10T09:00:00+08:00",
					dueAt: "2026-04-10T17:00:00+08:00",
				},
			],
			allowLateSubmission: true,
			description: "Submit the science report.",
			markdown: "# Science report",
		});

		const result = await parseTaskContent({
			text: "Science report",
			context: {
				userTimezone: "Asia/Singapore",
				localNowWithWeekday: "2026-04-09 10:00:00 (Thursday, GMT+8)",
			},
		});

		expect(result.structured.timeOptions).toEqual([
			{
				startAt: null,
				dueAt: "2026-04-10T17:00:00+08:00",
			},
			{
				startAt: "2026-04-10T09:00:00+08:00",
				dueAt: "2026-04-10T17:00:00+08:00",
			},
		]);
	});
});
