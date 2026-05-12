import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODEL = "alibaba/qwen3.6-27b";
const MAX_TOKENS = 8192;
const TEMPERATURE = 0;
const REQUEST_DELAY_MS = Number(process.env.LLM_PARSE_DELAY_MS ?? 1000);
const REQUEST_TIMEOUT_MS = Number(process.env.LLM_PARSE_TIMEOUT_MS ?? 60000);
const MAX_REQUEST_ATTEMPTS = 4;
const CASE_IDS = (process.env.LLM_PARSE_CASE_IDS ?? "")
	.split(",")
	.map((item) => item.trim())
	.filter(Boolean);
const TIMEZONE = "Asia/Shanghai";
const LOCAL_NOW = "2026-04-16 21:29:00 (Thursday, GMT+8)";
const ISO_8601_WITH_TZ_PATTERN =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const casesPath = path.join(__dirname, "cases.json");
const resultsDir = path.join(__dirname, "results");
const latestJsonPath = path.join(resultsDir, "latest.json");
const latestMarkdownPath = path.join(resultsDir, "latest.md");

const PARSE_OUTPUT_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: {
		title: { type: ["string", "null"] },
		timeOptions: {
			type: "array",
			items: {
				type: "object",
				additionalProperties: false,
				properties: {
					startAt: { type: ["string", "null"] },
					dueAt: { type: ["string", "null"] },
				},
				required: ["startAt", "dueAt"],
			},
		},
		allowLateSubmission: { type: ["boolean", "null"] },
		description: { type: ["string", "null"] },
		markdown: { type: "string" },
	},
	required: [
		"title",
		"timeOptions",
		"allowLateSubmission",
		"description",
		"markdown",
	],
};

const STRUCTURED_REQUIREMENTS = `
## Structured fields

- title: Concise task title. Same language as the input.
- timeOptions: 1-3 deadline interpretations. Prefer exactly 1. Only return 2-3 when dates are genuinely ambiguous. Each option has startAt and dueAt, both nullable.
- allowLateSubmission: true/false only if explicitly stated; otherwise null.
- description: One-sentence task summary. Same language as the input.

## Markdown document

- Same language as the input.
- Strictly follow the source content. Do not invent requirements or details not present in the input.
- Suggested structure: Title heading, Overview, Requirements, Timeline, Submission notes.
- Dates in markdown must be natural and human-readable, not ISO 8601.

## Datetime rules

- Structured startAt/dueAt values must use ISO 8601 with timezone offset, for example 2026-04-18T23:59:00+08:00.
- If a timezone is omitted in the task input, use +08:00.
- If a field is not present in the task input, return null rather than inventing it.`;

const LOCAL_TIME_REQUIREMENTS = `
- Resolve relative times using the provided Timezone and Now values.
- If dates are genuinely ambiguous, return multiple timeOptions rather than choosing one silently.`;

const NO_LOCAL_TIME_SYSTEM_PROMPT = `You are a task parser for an educational platform. Teachers provide task descriptions as text. Extract structured metadata and a Markdown draft. Return JSON only. Do not include reasoning, analysis, comments, or markdown fences outside the JSON object.
${STRUCTURED_REQUIREMENTS}`;

const WITH_LOCAL_TIME_SYSTEM_PROMPT = `You are a task parser for an educational platform. Teachers provide task descriptions as text. Extract structured metadata and a Markdown draft. Return JSON only. Do not include reasoning, analysis, comments, or markdown fences outside the JSON object.
${STRUCTURED_REQUIREMENTS}
${LOCAL_TIME_REQUIREMENTS}`;

async function loadEnv() {
	const envPath = path.join(repoRoot, ".env");
	try {
		const dotenv = await import("dotenv");
		dotenv.config({ path: envPath });
		return;
	} catch {
		// Fall back to a small .env parser so this script can run without adding
		// root-level dependencies.
	}

	if (!fs.existsSync(envPath)) {
		return;
	}

	const envText = fs.readFileSync(envPath, "utf8");
	for (const line of envText.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
		if (!match) continue;
		const [, key, rawValue] = match;
		if (process.env[key] !== undefined) continue;
		process.env[key] = rawValue
			.trim()
			.replace(/^(['"])(.*)\1$/, "$2")
			.replace(/\\n/g, "\n");
	}
}

function requireEnv(name) {
	const value = process.env[name]?.trim();
	if (!value) {
		throw new Error(`${name} is required`);
	}
	return value;
}

function buildUserText(testCase, withLocalTime) {
	const parts = [];
	if (withLocalTime) {
		parts.push(`Timezone: ${TIMEZONE}`, `Now: ${LOCAL_NOW}`, "");
	}
	parts.push(
		"Return valid JSON only. Do not include reasoning, analysis, comments, or markdown fences.",
		"",
		"Task input:",
		testCase.text,
	);
	return parts.join("\n");
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callMessages({ baseUrl, apiKey, system, userText }) {
	const body = {
		model: MODEL,
		max_tokens: MAX_TOKENS,
		temperature: TEMPERATURE,
		messages: [
			{
				role: "user",
				content: [{ type: "text", text: userText }],
			},
		],
		system,
		output_config: {
			format: {
				type: "json_schema",
				schema: PARSE_OUTPUT_SCHEMA,
			},
		},
	};

	for (let attempt = 1; attempt <= MAX_REQUEST_ATTEMPTS; attempt += 1) {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
		let response;

		try {
			response = await fetch(`${baseUrl.replace(/\/$/, "")}/messages`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
					"anthropic-version": "2023-06-01",
				},
				body: JSON.stringify(body),
				signal: controller.signal,
			});
		} catch (error) {
			clearTimeout(timeoutId);
			if (attempt < MAX_REQUEST_ATTEMPTS) {
				const waitMs = 5000 * attempt ** 2;
				console.warn(
					`Request failed; retrying in ${Math.round(waitMs / 1000)}s (${attempt}/${MAX_REQUEST_ATTEMPTS})`,
				);
				await sleep(waitMs);
				continue;
			}
			throw error;
		} finally {
			clearTimeout(timeoutId);
		}

		if (!response.ok) {
			const text = await response.text();
			const retryable = response.status === 429 || response.status >= 500;
			if (retryable && attempt < MAX_REQUEST_ATTEMPTS) {
				const waitMs = 5000 * attempt ** 2;
				console.warn(
					`HTTP ${response.status}; retrying in ${Math.round(waitMs / 1000)}s (${attempt}/${MAX_REQUEST_ATTEMPTS})`,
				);
				await sleep(waitMs);
				continue;
			}
			throw new Error(
				`LLM request failed: HTTP ${response.status} ${text.slice(0, 500)}`,
			);
		}

		const json = await response.json();
		const rawText =
			json.content?.find((item) => item?.type === "text" && item.text)?.text ??
			null;

		if (!rawText) {
			throw new Error("LLM response did not include text content");
		}

		return { rawText, responseUsage: json.usage ?? null };
	}

	throw new Error("LLM request failed after retries");
}

function parseJsonText(rawText) {
	try {
		return JSON.parse(rawText);
	} catch {
		const start = rawText.indexOf("{");
		const end = rawText.lastIndexOf("}");
		if (start >= 0 && end > start) {
			return JSON.parse(rawText.slice(start, end + 1));
		}
		throw new Error("Response text is not valid JSON");
	}
}

function validateParsedShape(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("Parsed result is not an object");
	}

	const allowedKeys = new Set([
		"title",
		"timeOptions",
		"allowLateSubmission",
		"description",
		"markdown",
	]);
	for (const key of Object.keys(value)) {
		if (!allowedKeys.has(key)) {
			throw new Error(`Unexpected field: ${key}`);
		}
	}

	if (!(typeof value.title === "string" || value.title === null)) {
		throw new Error("title must be string or null");
	}
	if (!Array.isArray(value.timeOptions)) {
		throw new Error("timeOptions must be an array");
	}
	if (value.timeOptions.length < 1 || value.timeOptions.length > 3) {
		throw new Error("timeOptions length must be 1-3");
	}
	for (const [index, option] of value.timeOptions.entries()) {
		if (!option || typeof option !== "object" || Array.isArray(option)) {
			throw new Error(`timeOptions[${index}] must be an object`);
		}
		if (!(typeof option.startAt === "string" || option.startAt === null)) {
			throw new Error(`timeOptions[${index}].startAt must be string or null`);
		}
		if (!(typeof option.dueAt === "string" || option.dueAt === null)) {
			throw new Error(`timeOptions[${index}].dueAt must be string or null`);
		}
	}
	if (
		!(
			typeof value.allowLateSubmission === "boolean" ||
			value.allowLateSubmission === null
		)
	) {
		throw new Error("allowLateSubmission must be boolean or null");
	}
	if (!(typeof value.description === "string" || value.description === null)) {
		throw new Error("description must be string or null");
	}
	if (typeof value.markdown !== "string") {
		throw new Error("markdown must be string");
	}

	return value;
}

function normalizeParsedDatetime(value) {
	if (!value || typeof value !== "string") {
		return null;
	}

	const trimmed = value.trim();
	if (!ISO_8601_WITH_TZ_PATTERN.test(trimmed)) {
		return null;
	}

	const parsed = new Date(trimmed);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}

	return trimmed;
}

function normalizeTimeOption(option) {
	const normalized = {
		startAt: normalizeParsedDatetime(option.startAt),
		dueAt: normalizeParsedDatetime(option.dueAt),
	};

	if (!normalized.startAt || !normalized.dueAt) {
		return normalized;
	}

	const startTime = new Date(normalized.startAt).getTime();
	const dueTime = new Date(normalized.dueAt).getTime();

	if (startTime > dueTime) {
		return { startAt: null, dueAt: null };
	}

	if (startTime === dueTime) {
		return { startAt: null, dueAt: normalized.dueAt };
	}

	return normalized;
}

function applySystemFilter(parsed) {
	return {
		...parsed,
		timeOptions: parsed.timeOptions.map(normalizeTimeOption),
	};
}

function sameInstant(actual, expected) {
	if (!actual || !expected) return false;
	const actualTime = new Date(actual).getTime();
	const expectedTime = new Date(expected).getTime();
	if (Number.isNaN(actualTime) || Number.isNaN(expectedTime)) return false;
	return actualTime === expectedTime;
}

function fieldValues(parsed, field) {
	return parsed.timeOptions.map((option) => option[field]).filter(Boolean);
}

function wasFieldBlanked(before, after, field) {
	if (!before || !after) return false;
	return before.timeOptions.some((option, index) => {
		const next = after.timeOptions[index];
		return Boolean(option?.[field]) && !next?.[field];
	});
}

function evaluateDateField({ caseExpected, result, field, beforeFilter = null }) {
	const expectedValues = caseExpected[field];
	if (!expectedValues) return "—";
	if (!result.ok) return "F";
	if (beforeFilter && wasFieldBlanked(beforeFilter, result.parsed, field)) {
		return "置空";
	}
	const values = fieldValues(result.parsed, field);
	return values.some((value) =>
		expectedValues.some((expected) => sameInstant(value, expected)),
	)
		? "✓"
		: "×";
}

function evaluateAllowLate({ caseExpected, result }) {
	if (!Object.prototype.hasOwnProperty.call(caseExpected, "allowLateSubmission")) {
		return "—";
	}
	if (!result.ok) return "F";
	return result.parsed.allowLateSubmission === caseExpected.allowLateSubmission
		? "✓"
		: "×";
}

function evaluateCase(testCase, groupResults) {
	const noLocal = groupResults.noLocal;
	const withLocal = groupResults.withLocal;
	const filtered = groupResults.filtered;
	const expected = testCase.expected ?? {};

	return {
		noLocal: {
			startAt: evaluateDateField({ caseExpected: expected, result: noLocal, field: "startAt" }),
			dueAt: evaluateDateField({ caseExpected: expected, result: noLocal, field: "dueAt" }),
			allowLateSubmission: evaluateAllowLate({ caseExpected: expected, result: noLocal }),
		},
		withLocal: {
			startAt: evaluateDateField({ caseExpected: expected, result: withLocal, field: "startAt" }),
			dueAt: evaluateDateField({ caseExpected: expected, result: withLocal, field: "dueAt" }),
			allowLateSubmission: evaluateAllowLate({ caseExpected: expected, result: withLocal }),
		},
		filtered: {
			startAt: evaluateDateField({
				caseExpected: expected,
				result: filtered,
				field: "startAt",
				beforeFilter: withLocal.ok ? withLocal.parsed : null,
			}),
			dueAt: evaluateDateField({
				caseExpected: expected,
				result: filtered,
				field: "dueAt",
				beforeFilter: withLocal.ok ? withLocal.parsed : null,
			}),
			allowLateSubmission: evaluateAllowLate({ caseExpected: expected, result: filtered }),
		},
	};
}

function toGroupResult(callResult) {
	try {
		const parsed = validateParsedShape(parseJsonText(callResult.rawText));
		return {
			ok: true,
			rawText: callResult.rawText,
			usage: callResult.responseUsage,
			parsed,
			error: null,
		};
	} catch (error) {
		return {
			ok: false,
			rawText: callResult.rawText,
			usage: callResult.responseUsage,
			parsed: null,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

function failedGroup(error) {
	return {
		ok: false,
		rawText: null,
		usage: null,
		parsed: null,
		error: error instanceof Error ? error.message : String(error),
	};
}

function makeFilteredGroup(withLocalResult) {
	if (!withLocalResult.ok) {
		return { ...withLocalResult };
	}
	return {
		ok: true,
		rawText: null,
		usage: null,
		parsed: applySystemFilter(withLocalResult.parsed),
		error: null,
	};
}

function markdownEscape(value) {
	return String(value ?? "")
		.replace(/\|/g, "\\|")
		.replace(/\n/g, "<br>");
}

function shortNote(value) {
	const text = String(value ?? "");
	return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function summarize(results) {
	const summary = {
		noLocal: emptySummary(),
		withLocal: emptySummary(),
		filtered: emptySummary(),
	};

	for (const item of results) {
		accumulate(summary.noLocal, item.evaluation.noLocal, item.groups.noLocal);
		accumulate(summary.withLocal, item.evaluation.withLocal, item.groups.withLocal);
		accumulate(summary.filtered, item.evaluation.filtered, item.groups.filtered);
	}

	return summary;
}

function emptySummary() {
	return {
		startAtCorrect: 0,
		dueAtCorrect: 0,
		allowLateCorrect: 0,
		errorFields: 0,
		fallbacks: 0,
		blankedBySystem: 0,
	};
}

function accumulate(target, evaluation, group) {
	if (!group.ok) {
		target.fallbacks += 1;
	}
	for (const [field, value] of Object.entries(evaluation)) {
		if (value === "✓") {
			if (field === "startAt") target.startAtCorrect += 1;
			if (field === "dueAt") target.dueAtCorrect += 1;
			if (field === "allowLateSubmission") target.allowLateCorrect += 1;
		}
		if (value === "×") {
			target.errorFields += 1;
		}
		if (value === "置空") {
			target.blankedBySystem += 1;
		}
	}
}

function buildMarkdown({ metadata, results, summary }) {
	const lines = [
		"# LLM 任务解析实验结果",
		"",
		`- 模型：\`${metadata.model}\``,
		`- API：Anthropic Messages API`,
		`- 温度：\`${metadata.temperature}\``,
		`- 请求间隔：\`${metadata.requestDelayMs}ms\``,
		`- 请求超时：\`${metadata.requestTimeoutMs}ms\``,
		`- 本地时间上下文：\`Timezone: ${metadata.timezone}\`，\`Now: ${metadata.localNow}\``,
		`- 运行时间：${metadata.generatedAt}`,
		"",
		"## 字段级结果",
		"",
		"| 编号 | 测试用例节选 | 类型 | 不带本地时间-开始 | 不带本地时间-截止 | 不带本地时间-迟交 | 带本地时间-开始 | 带本地时间-截止 | 带本地时间-迟交 | 系统过滤后-开始 | 系统过滤后-截止 | 系统过滤后-迟交 | 备注 |",
		"|---|---|---|---|---|---|---|---|---|---|---|---|---|",
	];

	for (const item of results) {
		lines.push(
			[
				item.id,
				markdownEscape(item.excerpt),
				markdownEscape(item.type),
				item.evaluation.noLocal.startAt,
				item.evaluation.noLocal.dueAt,
				item.evaluation.noLocal.allowLateSubmission,
				item.evaluation.withLocal.startAt,
				item.evaluation.withLocal.dueAt,
				item.evaluation.withLocal.allowLateSubmission,
				item.evaluation.filtered.startAt,
				item.evaluation.filtered.dueAt,
				item.evaluation.filtered.allowLateSubmission,
				markdownEscape(shortNote(item.note)),
			].join(" | ").replace(/^/, "| ").replace(/$/, " |"),
		);
	}

	lines.push(
		"",
		"## 汇总统计",
		"",
		"| 设置 | 开始时间正确数 | 截止时间正确数 | 迟交字段正确数 | 错误字段数 | 降级次数 | 系统置空次数 |",
		"|---|---:|---:|---:|---:|---:|---:|",
		summaryRow("不带本地时间", summary.noLocal),
		summaryRow("带本地时间", summary.withLocal),
		summaryRow("带本地时间且经过系统过滤", summary.filtered),
		"",
		"## 符号说明",
		"",
		"- `✓`：字段正确",
		"- `×`：字段错误",
		"- `—`：原文未包含该字段，不纳入统计",
		"- `F`：结构化解析失败或调用失败",
		"- `置空`：系统过滤主动置为 `null`",
	);

	return `${lines.join("\n")}\n`;
}

function summaryRow(label, item) {
	return `| ${label} | ${item.startAtCorrect} | ${item.dueAtCorrect} | ${item.allowLateCorrect} | ${item.errorFields} | ${item.fallbacks} | ${item.blankedBySystem} |`;
}

function makeNote(item) {
	const errors = [];
	for (const [groupName, group] of Object.entries(item.groups)) {
		if (!group.ok) {
			errors.push(`${groupName}: ${group.error}`);
		}
	}
	return errors.length > 0 ? errors.join("; ") : "";
}

async function run() {
	await loadEnv();
	const baseUrl = requireEnv("DEV_SEED_LLM_BASE_URL");
	const apiKey = requireEnv("DEV_SEED_LLM_API_KEY");
	const allCases = JSON.parse(fs.readFileSync(casesPath, "utf8"));
	const caseIdSet = new Set(CASE_IDS);
	const cases =
		CASE_IDS.length > 0
			? allCases.filter((testCase) => caseIdSet.has(testCase.id))
			: allCases;
	const results = [];

	if (CASE_IDS.length > 0 && cases.length !== CASE_IDS.length) {
		const foundIds = new Set(cases.map((testCase) => testCase.id));
		const missingIds = CASE_IDS.filter((id) => !foundIds.has(id));
		throw new Error(`Unknown case ids: ${missingIds.join(", ")}`);
	}

	console.log(`Running ${cases.length} cases with ${MODEL}`);

	for (const [index, testCase] of cases.entries()) {
		console.log(`[${index + 1}/${cases.length}] ${testCase.id} ${testCase.excerpt}`);

		let noLocal;
		let withLocal;

		try {
			noLocal = toGroupResult(
				await callMessages({
					baseUrl,
					apiKey,
					system: NO_LOCAL_TIME_SYSTEM_PROMPT,
					userText: buildUserText(testCase, false),
				}),
			);
		} catch (error) {
			noLocal = failedGroup(error);
		}

		if (REQUEST_DELAY_MS > 0) {
			await sleep(REQUEST_DELAY_MS);
		}

		try {
			withLocal = toGroupResult(
				await callMessages({
					baseUrl,
					apiKey,
					system: WITH_LOCAL_TIME_SYSTEM_PROMPT,
					userText: buildUserText(testCase, true),
				}),
			);
		} catch (error) {
			withLocal = failedGroup(error);
		}

		if (REQUEST_DELAY_MS > 0) {
			await sleep(REQUEST_DELAY_MS);
		}

		const filtered = makeFilteredGroup(withLocal);
		const groups = { noLocal, withLocal, filtered };
		const evaluation = evaluateCase(testCase, groups);
		const item = {
			id: testCase.id,
			type: testCase.type,
			excerpt: testCase.excerpt,
			text: testCase.text,
			expected: testCase.expected,
			groups,
			evaluation,
			note: "",
		};
		item.note = makeNote(item);
		results.push(item);
	}

	const existingOutput =
		CASE_IDS.length > 0 && fs.existsSync(latestJsonPath)
			? JSON.parse(fs.readFileSync(latestJsonPath, "utf8"))
			: null;
	const resultById = new Map(
		(existingOutput?.results ?? []).map((item) => [item.id, item]),
	);
	for (const item of results) {
		resultById.set(item.id, item);
	}
	const finalResults =
		CASE_IDS.length > 0 && existingOutput
			? allCases
					.map((testCase) => resultById.get(testCase.id))
					.filter(Boolean)
			: results;

	const metadata = {
		model: MODEL,
		api: "Anthropic Messages API",
		temperature: TEMPERATURE,
		maxTokens: MAX_TOKENS,
		timezone: TIMEZONE,
		localNow: LOCAL_NOW,
		baseUrlEnv: "DEV_SEED_LLM_BASE_URL",
		apiKeyEnv: "DEV_SEED_LLM_API_KEY",
		requestDelayMs: REQUEST_DELAY_MS,
		requestTimeoutMs: REQUEST_TIMEOUT_MS,
		caseIds: CASE_IDS,
		generatedAt: new Date().toISOString(),
	};
	const summary = summarize(finalResults);
	const output = { metadata, results: finalResults, summary };

	fs.mkdirSync(resultsDir, { recursive: true });
	fs.writeFileSync(latestJsonPath, `${JSON.stringify(output, null, 2)}\n`);
	fs.writeFileSync(
		latestMarkdownPath,
		buildMarkdown({ metadata, results: finalResults, summary }),
	);

	console.log(`Wrote ${path.relative(repoRoot, latestJsonPath)}`);
	console.log(`Wrote ${path.relative(repoRoot, latestMarkdownPath)}`);
}

run().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
