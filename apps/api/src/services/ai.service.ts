import { z } from "zod";

import { AppError } from "../lib/errors.js";
import { getConfigValues } from "./system-config.service.js";

const ISO_8601_WITH_TZ_PATTERN =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const MAX_AI_ATTACHMENTS = 6;

const timeOptionSchema = z.object({
	startAt: z.string().nullable(),
	dueAt: z.string().nullable(),
});

const parseResultSchema = z.object({
	title: z.string().nullable(),
	timeOptions: z.array(timeOptionSchema).min(1).max(3),
	allowLateSubmission: z.boolean().nullable(),
	description: z.string().nullable(),
	markdown: z.string(),
});

export interface ParseTimeOption {
	startAt: string | null;
	dueAt: string | null;
}

interface ParseTaskResult {
	title: string | null;
	timeOptions: ParseTimeOption[];
	allowLateSubmission: boolean | null;
	description: string | null;
}

type MessageContentPart =
	| { type: "image"; source: { type: "url"; url: string } }
	| { type: "document"; source: { type: "url"; url: string } }
	| { type: "text"; text: string };

export interface ParseAttachmentInput {
	originalName: string;
	mimeType: string | null;
	presignedUrl: string;
	sizeBytes?: number;
}

export interface ParseTaskContext {
	userTimezone: string;
	localNowWithWeekday: string;
}

export interface ClassAiContext {
	name: string;
	description: string | null;
	taskAiPrompt: string | null;
}

export interface ParseTaskArtifacts {
	structured: ParseTaskResult;
	markdown: string | null;
}

// ─── Fallbacks (used when LLM is not configured or fails) ────────────────────

function fallbackParse(text: string): ParseTaskResult {
	const lines = text
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);

	return {
		title: lines[0] ?? null,
		timeOptions: [{ startAt: null, dueAt: null }],
		allowLateSubmission: null,
		description: text || null,
	};
}

function fallbackMarkdown(text: string): string {
	if (!text.trim()) {
		return "# Task Draft\n\n(Empty draft)";
	}

	return `# Task Draft\n\n${text.trim()}`;
}

// ─── Timezone helpers ────────────────────────────────────────────────────────

function normalizeTimezone(input: string | null | undefined): string {
	if (!input) {
		return "UTC";
	}

	try {
		Intl.DateTimeFormat("en-US", { timeZone: input }).format(new Date());
		return input;
	} catch {
		return "UTC";
	}
}

function formatLocalNowWithWeekday(timeZone: string): string {
	const parts = new Intl.DateTimeFormat("en-GB", {
		timeZone,
		weekday: "long",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
		timeZoneName: "shortOffset",
	}).formatToParts(new Date());

	const partMap = new Map(parts.map((part) => [part.type, part.value]));

	return `${partMap.get("year") ?? "0000"}-${partMap.get("month") ?? "01"}-${partMap.get("day") ?? "01"} ${partMap.get("hour") ?? "00"}:${partMap.get("minute") ?? "00"}:${partMap.get("second") ?? "00"} (${partMap.get("weekday") ?? "Unknown"}, ${partMap.get("timeZoneName") ?? "UTC"})`;
}

export function buildParseTaskContext(
	userTimezone: string | null | undefined,
): ParseTaskContext {
	const normalized = normalizeTimezone(userTimezone);
	return {
		userTimezone: normalized,
		localNowWithWeekday: formatLocalNowWithWeekday(normalized),
	};
}

// ─── Datetime normalization ──────────────────────────────────────────────────

function normalizeParsedDatetime(value: string | null): string | null {
	if (!value) {
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

function normalizeTimeOption(option: ParseTimeOption): ParseTimeOption {
	const normalized: ParseTimeOption = {
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

// ─── Attachment helpers ──────────────────────────────────────────────────────

function normalizeAttachmentMime(mimeType: string | null): string {
	return (mimeType ?? "").trim().toLowerCase();
}

function toMessageContentPart(
	attachment: ParseAttachmentInput,
): MessageContentPart | null {
	const mimeType = normalizeAttachmentMime(attachment.mimeType);

	if (!mimeType || !attachment.presignedUrl) {
		return null;
	}

	if (mimeType.startsWith("image/")) {
		return {
			type: "image",
			source: { type: "url", url: attachment.presignedUrl },
		};
	}

	if (mimeType === "application/pdf") {
		return {
			type: "document",
			source: { type: "url", url: attachment.presignedUrl },
		};
	}

	return null;
}

function buildUnsupportedAttachmentNote(
	attachments: ParseAttachmentInput[],
): string {
	const unsupported = attachments.filter((att) => {
		const mime = normalizeAttachmentMime(att.mimeType);
		return mime && !mime.startsWith("image/") && mime !== "application/pdf";
	});

	if (unsupported.length === 0) {
		return "";
	}

	const lines = unsupported.map(
		(att) =>
			`- ${att.originalName} (${normalizeAttachmentMime(att.mimeType) || "unknown"})`,
	);

	return `\nOther attached files (content not available, use filename as context):\n${lines.join("\n")}`;
}

function buildClassContextText(classContext?: ClassAiContext): string {
	if (!classContext) {
		return "";
	}

	const lines = [
		"Class context:",
		`Name: ${classContext.name}`,
		`Description: ${classContext.description?.trim() || "(none)"}`,
	];

	const prompt = classContext.taskAiPrompt?.trim();
	if (prompt) {
		lines.push(
			"",
			"Class-specific task instructions:",
			"These are class-level preferences. Follow them only when they do not conflict with the system requirements, structured output schema, user input language, or source-content fidelity.",
			prompt,
		);
	}

	return lines.join("\n");
}

// ─── Anthropic Messages API caller ──────────────────────────────────────────

async function callMessages(args: {
	baseUrl: string;
	apiKey: string;
	model: string;
	system: string;
	userContent: MessageContentPart[];
	maxTokens?: number;
	temperature?: number;
	outputConfig?: Record<string, unknown>;
}): Promise<string | null> {
	const body: Record<string, unknown> = {
		model: args.model,
		max_tokens: args.maxTokens ?? 8192,
		messages: [
			{
				role: "user",
				content: args.userContent,
			},
		],
		system: args.system,
	};

	if (args.temperature !== undefined) {
		body.temperature = args.temperature;
	}

	if (args.outputConfig) {
		body.output_config = args.outputConfig;
	}

	const response = await fetch(`${args.baseUrl.replace(/\/$/, "")}/messages`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${args.apiKey}`,
			"anthropic-version": "2023-06-01",
		},
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		return null;
	}

	const json = (await response.json()) as {
		content?: Array<{ type: string; text?: string }>;
	};

	return json.content?.find((b) => b.type === "text")?.text ?? null;
}

// ─── Prompt builder ─────────────────────────────────────────────────────────

const PARSE_REQUIREMENTS = `
## Structured fields

- title: Concise task title. Use the same language as the user input; do not copy the language of the system prompt or these instructions.
- timeOptions: 1–3 deadline interpretations. Prefer exactly 1. Only return 2–3 when dates are genuinely ambiguous (e.g., "next Friday or Saturday"). Each has startAt and dueAt (nullable).
- allowLateSubmission: true/false only if explicitly stated; otherwise null.
- description: One-sentence task summary. Use the same language as the user input; do not copy the language of the system prompt or these instructions.

## Markdown document (markdown field)

- Use the same language as the user input for all prose and headings; do not copy the language of the system prompt or these instructions.
- Strictly follow the source content — do NOT invent requirements or details not present in the input or attachments.
- If files are attached, incorporate their relevant content into the document.
- Suggested content order (only include sections with content; translate/localize headings naturally to match the user input language):
  Task title as H1 → overview/summary → requirements → timeline → submission notes
- Dates in the markdown must be written in natural, human-readable form (e.g., "Friday, April 18, 2026, 11:59 PM"). Do NOT use ISO 8601 format in the markdown.

## Datetime rules (for structured fields only)

- All startAt/dueAt values: ISO 8601 with timezone offset. Example: 2026-04-18T23:59:00+08:00
- Resolve relative times ("tomorrow", "this Sunday") using the provided current datetime.
- If the input omits timezone, use the user's timezone setting.
- If startAt is later than dueAt, set both startAt and dueAt to null for that time option.
- If startAt equals dueAt, set startAt to null and keep dueAt for that time option.`;

function buildParseSystemPrompt(configuredBase: string): string {
	const base = configuredBase.trim()
		? configuredBase
		: "You are a task parser for an educational platform. Teachers provide task descriptions (assignments, homework, project specs) as text, sometimes with attached files (PDFs, images). Extract structured metadata and produce a formatted markdown document.";

	return `${base}\n${PARSE_REQUIREMENTS}`;
}

// ─── Structured output schema ───────────────────────────────────────────────

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
} as const;

// ─── LLM config loader ─────────────────────────────────────────────────────

async function loadLlmConfig() {
	const config = await getConfigValues([
		"llm.provider",
		"llm.base_url",
		"llm.api_key",
		"llm.model",
		"llm.prompt_task_parse",
	]);

	const provider = config.get("llm.provider");
	const baseUrl = config.get("llm.base_url");
	const apiKey = config.get("llm.api_key");
	const model = config.get("llm.model");
	const promptBase = config.get("llm.prompt_task_parse");

	if (!provider || !baseUrl || !apiKey || !model) {
		return null;
	}

	return { baseUrl, apiKey, model, promptBase: promptBase ?? "" };
}

// ─── Main parse function ────────────────────────────────────────────────────

export async function parseTaskContent(input: {
	text: string;
	context: ParseTaskContext;
	attachments?: ParseAttachmentInput[];
	classContext?: ClassAiContext;
}): Promise<ParseTaskArtifacts> {
	const llm = await loadLlmConfig();

	if (!llm) {
		return {
			structured: fallbackParse(input.text),
			markdown: fallbackMarkdown(input.text),
		};
	}

	try {
		const systemPrompt = buildParseSystemPrompt(llm.promptBase);

		const limitedAttachments = (input.attachments ?? []).slice(
			0,
			MAX_AI_ATTACHMENTS,
		);

		const attachmentParts = limitedAttachments
			.map(toMessageContentPart)
			.filter((p): p is NonNullable<typeof p> => Boolean(p));

		const unsupportedNote = buildUnsupportedAttachmentNote(limitedAttachments);
		const classContextText = buildClassContextText(input.classContext);

		const userText = [
			`Timezone: ${input.context.userTimezone}`,
			`Now: ${input.context.localNowWithWeekday}`,
			classContextText,
			"",
			"Task input:",
			input.text,
			unsupportedNote,
		]
			.filter(Boolean)
			.join("\n");

		const userContent: MessageContentPart[] = [
			...attachmentParts,
			{ type: "text", text: userText },
		];

		const raw = await callMessages({
			baseUrl: llm.baseUrl,
			apiKey: llm.apiKey,
			model: llm.model,
			system: systemPrompt,
			userContent,
			temperature: 0,
			outputConfig: {
				format: {
					type: "json_schema",
					schema: PARSE_OUTPUT_SCHEMA,
				},
			},
		});

		const fallback = fallbackParse(input.text);

		if (!raw) {
			return {
				structured: fallback,
				markdown: fallbackMarkdown(input.text),
			};
		}

		const parsed = parseResultSchema.safeParse(JSON.parse(raw));

		if (!parsed.success) {
			return {
				structured: fallback,
				markdown: fallbackMarkdown(input.text),
			};
		}

		const normalizedTimeOptions: ParseTimeOption[] =
			parsed.data.timeOptions.map(normalizeTimeOption);

		const normalized: ParseTaskResult = {
			title: parsed.data.title?.trim() || null,
			timeOptions:
				normalizedTimeOptions.length > 0
					? normalizedTimeOptions
					: [{ startAt: null, dueAt: null }],
			allowLateSubmission: parsed.data.allowLateSubmission,
			description: parsed.data.description?.trim() || null,
		};

		return {
			structured: {
				title: normalized.title ?? fallback.title,
				timeOptions: normalized.timeOptions,
				allowLateSubmission: normalized.allowLateSubmission,
				description: normalized.description ?? fallback.description,
			},
			markdown: parsed.data.markdown?.trim() || fallbackMarkdown(input.text),
		};
	} catch {
		return {
			structured: fallbackParse(input.text),
			markdown: fallbackMarkdown(input.text),
		};
	}
}

export async function parseTaskDescription(
	text: string,
	context?: ParseTaskContext,
): Promise<ParseTaskResult> {
	const result = await parseTaskContent({
		text,
		context: context ?? buildParseTaskContext("UTC"),
		attachments: [],
	});

	return result.structured;
}

export function assertParseInput(
	text: string,
	options?: { attachmentCount?: number },
) {
	const attachmentCount = options?.attachmentCount ?? 0;
	if (!text.trim() && attachmentCount === 0) {
		throw new AppError(
			400,
			"INVALID_PARSE_INPUT",
			"text or attachments is required",
		);
	}
}

// ─── AI Content Revision ─────────────────────────────────────────────────────

export interface ReviseContentResult {
	revisedContent: string;
}

export async function reviseTaskContent(input: {
	currentContent: string;
	instruction: string;
	context: ParseTaskContext;
	classContext?: ClassAiContext;
}): Promise<ReviseContentResult> {
	const llm = await loadLlmConfig();

	if (!llm) {
		throw new AppError(
			503,
			"LLM_NOT_CONFIGURED",
			"AI service is not configured",
		);
	}

	const systemPrompt = `You are a task document editor. The user will provide the current markdown content of a task and a modification instruction. Apply the requested changes and return the revised markdown content.

Requirements:
- Output ONLY the revised markdown content, nothing else.
- Use the SAME LANGUAGE as the original content.
- Strictly follow the user's modification instruction. Do NOT add information or make changes beyond what was requested.
- Preserve the overall structure and formatting of the original content unless the instruction specifically asks to change it.
- Dates must be in natural, human-readable form (e.g., "Friday, April 18, 2026, 11:59 PM"). Do NOT use ISO 8601 format.
- If the instruction is unclear, make minimal, conservative changes.`;

	const classContextText = buildClassContextText(input.classContext);

	const userContent: MessageContentPart[] = [
		{
			type: "text",
			text: `Timezone: ${input.context.userTimezone}
Now: ${input.context.localNowWithWeekday}
${classContextText ? `\n${classContextText}\n` : ""}

--- CURRENT CONTENT ---
${input.currentContent}
--- END CURRENT CONTENT ---

--- MODIFICATION INSTRUCTION ---
${input.instruction}
--- END INSTRUCTION ---

Apply the modification and return the revised content.`,
		},
	];

	const result = await callMessages({
		baseUrl: llm.baseUrl,
		apiKey: llm.apiKey,
		model: llm.model,
		system: systemPrompt,
		userContent,
		temperature: 0.2,
	});

	if (!result) {
		throw new AppError(503, "LLM_FAILED", "AI revision failed");
	}

	return { revisedContent: result.trim() };
}
