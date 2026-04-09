import { z } from "zod";

import { AppError } from "../lib/errors.js";
import { getConfigValue } from "./system-config.service.js";

const ISO_8601_WITH_TZ_PATTERN =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const MAX_AI_ATTACHMENTS = 6;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_INLINE_TEXT_ATTACHMENT_CHARS = 8_000;

const timeOptionSchema = z.object({
	startAt: z.string().nullable(),
	dueAt: z.string().nullable(),
});

const parseResultSchema = z.object({
	title: z.string().nullable(),
	timeOptions: z.array(timeOptionSchema).min(1).max(3),
	allowLateSubmission: z.boolean().nullable(),
	description: z.string().nullable(),
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

type GatewayAttachmentPart =
	| {
			type: "image_url";
			image_url: {
				url: string;
				detail: "auto";
			};
	  }
	| {
			type: "file";
			file: {
				data: string;
				media_type: "application/pdf";
				filename: string;
			};
	  };

export interface ParseAttachmentInput {
	originalName: string;
	mimeType: string | null;
	bytes?: Buffer;
	presignedUrl?: string;
	sizeBytes?: number;
}

export interface ParseTaskContext {
	userTimezone: string;
	localNowWithWeekday: string;
}

export interface ParseTaskArtifacts {
	structured: ParseTaskResult;
	markdown: string | null;
}

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

function normalizeAttachmentMime(mimeType: string | null): string {
	return (mimeType ?? "").trim().toLowerCase();
}

function isTextLikeMime(mimeType: string): boolean {
	return (
		mimeType.startsWith("text/") ||
		mimeType === "application/json" ||
		mimeType === "application/xml" ||
		mimeType === "text/markdown"
	);
}

function extractInlineAttachmentText(
	attachment: ParseAttachmentInput,
): string | null {
	const mimeType = normalizeAttachmentMime(attachment.mimeType);

	if (!isTextLikeMime(mimeType) || !attachment.bytes) {
		return null;
	}

	try {
		const text = attachment.bytes.toString("utf8").trim();

		if (!text) {
			return null;
		}

		if (text.length <= MAX_INLINE_TEXT_ATTACHMENT_CHARS) {
			return text;
		}

		return `${text.slice(0, MAX_INLINE_TEXT_ATTACHMENT_CHARS)}\n...(truncated)...`;
	} catch {
		return null;
	}
}

function toGatewayAttachmentPart(
	attachment: ParseAttachmentInput,
): GatewayAttachmentPart | null {
	const mimeType = normalizeAttachmentMime(attachment.mimeType);

	if (!mimeType) {
		return null;
	}

	// Skip oversized attachments (only check when bytes are available; URL-only
	// attachments were already validated at upload time)
	if (attachment.bytes && attachment.bytes.byteLength > MAX_ATTACHMENT_BYTES) {
		return null;
	}

	if (mimeType.startsWith("image/")) {
		const url =
			attachment.presignedUrl ??
			(attachment.bytes
				? `data:${mimeType};base64,${attachment.bytes.toString("base64")}`
				: null);

		if (!url) return null;

		return {
			type: "image_url",
			image_url: { url, detail: "auto" },
		};
	}

	if (mimeType === "application/pdf" && attachment.bytes) {
		return {
			type: "file",
			file: {
				data: attachment.bytes.toString("base64"),
				media_type: "application/pdf",
				filename: attachment.originalName,
			},
		};
	}

	return null;
}

function buildAttachmentContextBlock(
	attachments: ParseAttachmentInput[],
): string {
	if (attachments.length === 0) {
		return "";
	}

	const lines = ["", "Attachment context:"];

	for (const attachment of attachments.slice(0, MAX_AI_ATTACHMENTS)) {
		const mimeType = normalizeAttachmentMime(attachment.mimeType) || "unknown";
		const inlineText = extractInlineAttachmentText(attachment);

		const size = attachment.bytes?.byteLength ?? attachment.sizeBytes ?? 0;
		lines.push(`- ${attachment.originalName} (${mimeType}, ${size} bytes)`);

		if (inlineText) {
			lines.push(`  content:\n${inlineText}`);
		}
	}

	lines.push(
		"",
		"If binary office files cannot be parsed from content, use filenames and user text context conservatively.",
	);

	return lines.join("\n");
}

function buildAttachmentFallbackNote(parts: GatewayAttachmentPart[]): string {
	if (parts.length === 0) {
		return "";
	}

	const lines = parts.map((part) => {
		if (part.type === "image_url") {
			return "- image attachment";
		}

		return `- pdf attachment: ${part.file.filename}`;
	});

	return [
		"",
		"Attachment metadata (content may be unavailable with current provider route):",
		...lines,
	].join("\n");
}

function extractMessageText(content: unknown): string | null {
	if (typeof content === "string") {
		return content;
	}

	if (!Array.isArray(content)) {
		return null;
	}

	const texts = content
		.map((item) => {
			if (typeof item !== "object" || item === null) {
				return null;
			}

			const maybeText = (item as { text?: unknown }).text;
			return typeof maybeText === "string" ? maybeText : null;
		})
		.filter((value): value is string => Boolean(value));

	if (texts.length === 0) {
		return null;
	}

	return texts.join("\n");
}

async function callChatCompletions(args: {
	baseUrl: string;
	apiKey: string;
	body: Record<string, unknown>;
}) {
	const response = await fetch(
		`${args.baseUrl.replace(/\/$/, "")}/chat/completions`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${args.apiKey}`,
			},
			body: JSON.stringify(args.body),
		},
	);

	if (!response.ok) {
		return null;
	}

	const json = (await response.json()) as {
		choices?: Array<{ message?: { content?: unknown } }>;
	};

	return extractMessageText(json.choices?.[0]?.message?.content);
}

function getStructuredPrompt(basePrompt: string): string {
	return `${basePrompt}

Requirements:
- Output strict JSON only.
- Generate the title in the SAME LANGUAGE as the user's input text.
- Datetime fields must be ISO 8601 with timezone offset or Z. Example: 2026-03-22T09:00:00+08:00
- If the text has relative time (e.g. tomorrow, day after tomorrow, this Sunday evening), resolve it by the provided local datetime context.
- If timezone is missing in user text, interpret it in the user's timezone and still output ISO with timezone.
- timeOptions: an array of 1–3 possible start/due date interpretations.
  - STRONGLY prefer returning exactly 1 option. Only return 2–3 when the user's input is genuinely ambiguous about dates (e.g. "next Friday or Saturday").
  - Each option has startAt (nullable) and dueAt (nullable).
- allowLateSubmission: boolean or null. Set to true/false only if the user explicitly mentions it; otherwise null.`;
}

function getMarkdownPrompt(basePrompt: string): string {
	return `${basePrompt}

Requirements:
- Output only markdown.
- Use the SAME LANGUAGE as the user's input text.
- Strictly follow the user's content. Do NOT add information, details, or requirements that the user did not mention.
- Organize into clear sections and bullet points.
- Include timeline interpretation based on provided local datetime context.
- Keep the writing concise and task-oriented.`;
}

export async function parseTaskContent(input: {
	text: string;
	context: ParseTaskContext;
	attachments?: ParseAttachmentInput[];
}): Promise<ParseTaskArtifacts> {
	const provider = await getConfigValue("llm.provider");
	const baseUrl = await getConfigValue("llm.base_url");
	const apiKey = await getConfigValue("llm.api_key");
	const model = await getConfigValue("llm.model");
	const configuredStructuredPrompt = await getConfigValue(
		"llm.prompt_task_parse_structured",
	);
	const configuredMarkdownPrompt = await getConfigValue(
		"llm.prompt_task_parse_markdown",
	);

	if (!provider || !baseUrl || !apiKey || !model) {
		return {
			structured: fallbackParse(input.text),
			markdown: fallbackMarkdown(input.text),
		};
	}

	try {
		const structuredPrompt = getStructuredPrompt(
			configuredStructuredPrompt?.trim()
				? configuredStructuredPrompt
				: "Extract task fields into JSON schema {title,startAt,dueAt,description}.",
		);
		const markdownPrompt = getMarkdownPrompt(
			configuredMarkdownPrompt?.trim()
				? configuredMarkdownPrompt
				: "Generate a markdown task brief from the provided text and files.",
		);

		const limitedAttachments = (input.attachments ?? []).slice(
			0,
			MAX_AI_ATTACHMENTS,
		);
		const attachmentParts = limitedAttachments
			.map(toGatewayAttachmentPart)
			.filter((item): item is NonNullable<typeof item> => Boolean(item));
		const attachmentContextText =
			buildAttachmentContextBlock(limitedAttachments);

		const userPromptText = [
			`User timezone setting: ${input.context.userTimezone}`,
			`Current local datetime (with weekday): ${input.context.localNowWithWeekday}`,
			"",
			"Task natural language input:",
			input.text,
			attachmentContextText,
		]
			.filter(Boolean)
			.join("\n");

		const textOnlyPrompt = `${userPromptText}${buildAttachmentFallbackNote(attachmentParts)}`;

		const multimodalContent = [
			...attachmentParts,
			{
				type: "text",
				text: userPromptText,
			},
		];
		const textOnlyContent = [
			{
				type: "text",
				text: textOnlyPrompt,
			},
		];
		const firstPassContent =
			attachmentParts.length > 0 ? multimodalContent : textOnlyContent;

		const runStructured = (content: unknown) =>
			callChatCompletions({
				baseUrl,
				apiKey,
				body: {
					model,
					temperature: 0,
					messages: [
						{
							role: "system",
							content: structuredPrompt,
						},
						{
							role: "user",
							content,
						},
					],
					response_format: {
						type: "json_schema",
						json_schema: {
							name: "task_parse_output",
							strict: true,
							schema: {
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
								},
								required: [
									"title",
									"timeOptions",
									"allowLateSubmission",
									"description",
								],
							},
						},
					},
				},
			});

		const runMarkdown = (content: unknown) =>
			callChatCompletions({
				baseUrl,
				apiKey,
				body: {
					model,
					temperature: 0.2,
					messages: [
						{
							role: "system",
							content: markdownPrompt,
						},
						{
							role: "user",
							content,
						},
					],
				},
			});

		let [structuredRaw, markdownRaw] = await Promise.all([
			runStructured(firstPassContent),
			runMarkdown(firstPassContent),
		]);

		if (attachmentParts.length > 0 && !structuredRaw) {
			structuredRaw = await runStructured(textOnlyContent);
		}

		if (attachmentParts.length > 0 && !markdownRaw) {
			markdownRaw = await runMarkdown(textOnlyContent);
		}

		const fallback = fallbackParse(input.text);

		if (!structuredRaw) {
			return {
				structured: fallback,
				markdown: markdownRaw?.trim()
					? markdownRaw.trim()
					: fallbackMarkdown(input.text),
			};
		}

		const parsed = parseResultSchema.safeParse(JSON.parse(structuredRaw));

		if (!parsed.success) {
			return {
				structured: fallback,
				markdown: markdownRaw?.trim()
					? markdownRaw.trim()
					: fallbackMarkdown(input.text),
			};
		}

		const normalizedTimeOptions: ParseTimeOption[] =
			parsed.data.timeOptions.map((opt) => ({
				startAt: normalizeParsedDatetime(opt.startAt),
				dueAt: normalizeParsedDatetime(opt.dueAt),
			}));

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
			markdown: markdownRaw?.trim()
				? markdownRaw.trim()
				: fallbackMarkdown(input.text),
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

export function assertParseInput(text: string) {
	if (!text.trim()) {
		throw new AppError(400, "INVALID_PARSE_INPUT", "text is required");
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
}): Promise<ReviseContentResult> {
	const provider = await getConfigValue("llm.provider");
	const baseUrl = await getConfigValue("llm.base_url");
	const apiKey = await getConfigValue("llm.api_key");
	const model = await getConfigValue("llm.model");

	if (!provider || !baseUrl || !apiKey || !model) {
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
- If the instruction is unclear, make minimal, conservative changes.`;

	const userPrompt = `User timezone: ${input.context.userTimezone}
Current local datetime: ${input.context.localNowWithWeekday}

--- CURRENT CONTENT ---
${input.currentContent}
--- END CURRENT CONTENT ---

--- MODIFICATION INSTRUCTION ---
${input.instruction}
--- END INSTRUCTION ---

Please apply the modification and return the revised content.`;

	const result = await callChatCompletions({
		baseUrl,
		apiKey,
		body: {
			model,
			temperature: 0.2,
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userPrompt },
			],
		},
	});

	if (!result) {
		throw new AppError(503, "LLM_FAILED", "AI revision failed");
	}

	return { revisedContent: result.trim() };
}
