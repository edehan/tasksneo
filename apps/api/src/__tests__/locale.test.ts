import { describe, expect, it } from "vitest";
import {
	renderPasswordResetEmail,
	renderTaskNotificationEmail,
} from "../lib/email-templates.js";
import {
	normalizeLocale,
	resolveLocaleFromAcceptLanguage,
} from "../lib/locale.js";

describe("locale helpers", () => {
	it("matches supported language variants and falls back to English", () => {
		expect(resolveLocaleFromAcceptLanguage("zh-TW,zh;q=0.9")).toBe("zh-CN");
		expect(resolveLocaleFromAcceptLanguage("en-GB,en;q=0.9")).toBe("en");
		expect(resolveLocaleFromAcceptLanguage("fr-CA,fr;q=0.9")).toBe("fr");
		expect(resolveLocaleFromAcceptLanguage("ja-JP,ja;q=0.9")).toBe("ja");
		expect(resolveLocaleFromAcceptLanguage("ko-KR,ko;q=0.9")).toBe("en");
		expect(normalizeLocale("unknown")).toBe("en");
	});
});

describe("localized email templates", () => {
	it("renders core mail in every supported locale", () => {
		for (const locale of ["en", "zh-CN", "fr", "ja"] as const) {
			const rendered = renderPasswordResetEmail(locale, {
				appTitle: "TaskNeo",
				url: "https://taskneo.example/reset-password?token=test",
			});

			expect(rendered.subject).toContain("TaskNeo");
			expect(rendered.text).toContain("https://taskneo.example");
			expect(rendered.html).toContain(`lang="${locale}"`);
		}
	});

	it("localizes task notification dates and labels", () => {
		const rendered = renderTaskNotificationEmail("en", {
			appTitle: "TaskNeo",
			baseUrl: "https://taskneo.example",
			timezone: "UTC",
			taskId: "task-1",
			className: "Physics",
			classColor: "#2C6E91",
			taskTitle: "Lab",
			dueAt: null,
			type: "TASK_DUE_REMINDER",
		});

		expect(rendered.subject).toBe("[TaskNeo] Task due soon: Lab");
		expect(rendered.text).toContain("Not set");
		expect(rendered.html).toContain("View Task");
	});
});
