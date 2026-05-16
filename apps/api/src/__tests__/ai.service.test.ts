import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetConfigValues } = vi.hoisted(() => ({
	mockGetConfigValues: vi.fn(),
}));

vi.mock("../services/system-config.service.js", () => ({
	getConfigValues: mockGetConfigValues,
}));

const { parseTaskContent, reviseTaskContent } = await import(
	"../services/ai.service.js"
);

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

function mockLlmText(text: string) {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => ({
			ok: true,
			json: async () => ({
				content: [{ type: "text", text }],
			}),
		})),
	);
}

function getLastRequestBody() {
	const fetchMock = vi.mocked(fetch);
	return JSON.parse(
		fetchMock.mock.calls[fetchMock.mock.calls.length - 1]?.[1]?.body as string,
	);
}

function getLastUserText() {
	const body = getLastRequestBody();
	return body.messages[0].content.find(
		(part: { type: string }) => part.type === "text",
	).text as string;
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

	it("instructs the model to localize markdown headings to the user input language", async () => {
		mockLlmResponse({
			title: "算法作业",
			timeOptions: [{ startAt: null, dueAt: null }],
			allowLateSubmission: null,
			description: "完成算法练习。",
			markdown: "# 算法作业",
		});

		await parseTaskContent({
			text: "请完成算法作业，下周五提交。",
			context: {
				userTimezone: "Asia/Singapore",
				localNowWithWeekday: "2026-04-09 10:00:00 (Thursday, GMT+8)",
			},
		});

		const fetchMock = vi.mocked(fetch);
		const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);

		expect(body.system).toContain(
			"Use the same language as the user input for all prose and headings",
		);
		expect(body.system).toContain("translate/localize headings naturally");
		expect(body.system).toContain(
			"Task title as H1 → overview/summary → requirements → timeline → submission notes",
		);
	});

	it("injects class context and non-empty class task instructions when parsing", async () => {
		mockLlmResponse({
			title: "Lab report",
			timeOptions: [{ startAt: null, dueAt: null }],
			allowLateSubmission: null,
			description: "Write the lab report.",
			markdown: "# Lab report",
		});

		await parseTaskContent({
			text: "Write the lab report.",
			context: {
				userTimezone: "Asia/Singapore",
				localNowWithWeekday: "2026-04-09 10:00:00 (Thursday, GMT+8)",
			},
			classContext: {
				name: "Physics 101",
				description: "Week 1 mechanics",
				taskAiPrompt:
					"Title tasks by deliverable, not course name. Include topic, artifact, or milestone. Max 12 words.",
			},
		});

		const userText = getLastUserText();
		expect(userText).toContain("Class context:");
		expect(userText).toContain("Name: Physics 101");
		expect(userText).toContain("Description: Week 1 mechanics");
		expect(userText).toContain("Class-specific task instructions:");
		expect(userText).toContain("Title tasks by deliverable");
	});

	it("omits class task instructions when the class prompt is empty", async () => {
		mockLlmResponse({
			title: "Lab report",
			timeOptions: [{ startAt: null, dueAt: null }],
			allowLateSubmission: null,
			description: "Write the lab report.",
			markdown: "# Lab report",
		});

		await parseTaskContent({
			text: "Write the lab report.",
			context: {
				userTimezone: "Asia/Singapore",
				localNowWithWeekday: "2026-04-09 10:00:00 (Thursday, GMT+8)",
			},
			classContext: {
				name: "Physics 101",
				description: null,
				taskAiPrompt: null,
			},
		});

		const userText = getLastUserText();
		expect(userText).toContain("Name: Physics 101");
		expect(userText).toContain("Description: (none)");
		expect(userText).not.toContain("Class-specific task instructions:");
	});

	it("adds a markdown image hint when exactly one image attachment is parsed", async () => {
		mockLlmResponse({
			title: "Lab report",
			timeOptions: [{ startAt: null, dueAt: null }],
			allowLateSubmission: null,
			description: "Write the lab report.",
			markdown: "# Lab report",
		});

		await parseTaskContent({
			text: "Use the uploaded image if useful.",
			context: {
				userTimezone: "Asia/Singapore",
				localNowWithWeekday: "2026-04-09 10:00:00 (Thursday, GMT+8)",
			},
			attachments: [
				{
					originalName: "lab.png",
					mimeType: "image/png",
					presignedUrl: "https://storage.test/lab.png",
					appUrl: "https://api.test/files/tasks/task-1/lab.png",
				},
			],
		});

		const userText = getLastUserText();
		expect(userText).toContain(
			"The user-provided image material is available at https://api.test/files/tasks/task-1/lab.png",
		);
		expect(userText).toContain(
			"If you think this image is useful for the generated markdown",
		);
	});

	it("does not add the markdown image hint when multiple images are parsed", async () => {
		mockLlmResponse({
			title: "Lab report",
			timeOptions: [{ startAt: null, dueAt: null }],
			allowLateSubmission: null,
			description: "Write the lab report.",
			markdown: "# Lab report",
		});

		await parseTaskContent({
			text: "Use the uploaded images if useful.",
			context: {
				userTimezone: "Asia/Singapore",
				localNowWithWeekday: "2026-04-09 10:00:00 (Thursday, GMT+8)",
			},
			attachments: [
				{
					originalName: "lab-a.png",
					mimeType: "image/png",
					presignedUrl: "https://storage.test/lab-a.png",
					appUrl: "https://api.test/files/tasks/task-1/lab-a.png",
				},
				{
					originalName: "lab-b.png",
					mimeType: "image/png",
					presignedUrl: "https://storage.test/lab-b.png",
					appUrl: "https://api.test/files/tasks/task-1/lab-b.png",
				},
			],
		});

		expect(getLastUserText()).not.toContain(
			"The user-provided image material is available at",
		);
	});

	it("injects class context for task revision", async () => {
		mockLlmText("# Revised lab report");

		await reviseTaskContent({
			currentContent: "# Lab report",
			instruction: "Make it clearer",
			context: {
				userTimezone: "Asia/Singapore",
				localNowWithWeekday: "2026-04-09 10:00:00 (Thursday, GMT+8)",
			},
			classContext: {
				name: "Physics 101",
				description: "Week 1 mechanics",
				taskAiPrompt: "Prefer deliverable titles.",
			},
		});

		const userText = getLastUserText();
		expect(userText).toContain("Class context:");
		expect(userText).toContain("Name: Physics 101");
		expect(userText).toContain("Description: Week 1 mechanics");
		expect(userText).toContain("Class-specific task instructions:");
		expect(userText).toContain("Prefer deliverable titles.");
	});
});
