import { z } from 'zod';

import { AppError } from '../lib/errors.js';
import { getConfigValue } from './system-config.service.js';

const ISO_8601_WITH_TZ_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const MAX_AI_ATTACHMENTS = 6;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

const parseResultSchema = z.object({
  title: z.string().nullable(),
  startAt: z.string().nullable(),
  dueAt: z.string().nullable(),
  description: z.string().nullable(),
});

interface ParseTaskResult {
  title: string | null;
  startAt: string | null;
  dueAt: string | null;
  description: string | null;
}

export interface ParseAttachmentInput {
  originalName: string;
  mimeType: string | null;
  bytes: Buffer;
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
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);

  return {
    title: lines[0] ?? null,
    startAt: null,
    dueAt: null,
    description: text || null,
  };
}

function fallbackMarkdown(text: string): string {
  if (!text.trim()) {
    return '# Task Draft\n\n(Empty draft)';
  }

  return `# Task Draft\n\n${text.trim()}`;
}

function normalizeTimezone(input: string | null | undefined): string {
  if (!input) {
    return 'UTC';
  }

  try {
    Intl.DateTimeFormat('en-US', { timeZone: input }).format(new Date());
    return input;
  } catch {
    return 'UTC';
  }
}

function formatLocalNowWithWeekday(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'shortOffset',
  }).formatToParts(new Date());

  const partMap = new Map(parts.map((part) => [part.type, part.value]));

  return `${partMap.get('year') ?? '0000'}-${partMap.get('month') ?? '01'}-${partMap.get('day') ?? '01'} ${partMap.get('hour') ?? '00'}:${partMap.get('minute') ?? '00'}:${partMap.get('second') ?? '00'} (${partMap.get('weekday') ?? 'Unknown'}, ${partMap.get('timeZoneName') ?? 'UTC'})`;
}

export function buildParseTaskContext(userTimezone: string | null | undefined): ParseTaskContext {
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

function toAllowedAttachment(attachment: ParseAttachmentInput) {
  const mimeType = attachment.mimeType ?? '';
  const isImage = mimeType.startsWith('image/');
  const isDocument = mimeType === 'application/pdf'
    || mimeType === 'application/msword'
    || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || mimeType === 'application/vnd.ms-excel'
    || mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    || mimeType === 'application/vnd.ms-powerpoint'
    || mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    || mimeType.startsWith('text/')
    || mimeType === 'application/json';

  if (!isImage && !isDocument) {
    return null;
  }

  if (attachment.bytes.byteLength > MAX_ATTACHMENT_BYTES) {
    return null;
  }

  const normalizedMime = mimeType || 'application/octet-stream';
  const base64 = attachment.bytes.toString('base64');

  return {
    type: 'file',
    file: {
      filename: attachment.originalName,
      file_data: `data:${normalizedMime};base64,${base64}`,
    },
  };
}

function extractMessageText(content: unknown): string | null {
  if (typeof content === 'string') {
    return content;
  }

  if (!Array.isArray(content)) {
    return null;
  }

  const texts = content
    .map((item) => {
      if (typeof item !== 'object' || item === null) {
        return null;
      }

      const maybeText = (item as { text?: unknown }).text;
      return typeof maybeText === 'string' ? maybeText : null;
    })
    .filter((value): value is string => Boolean(value));

  if (texts.length === 0) {
    return null;
  }

  return texts.join('\n');
}

async function callChatCompletions(args: {
  baseUrl: string;
  apiKey: string;
  body: Record<string, unknown>;
}) {
  const response = await fetch(`${args.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify(args.body),
  });

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
- Datetime fields must be ISO 8601 with timezone offset or Z. Example: 2026-03-22T09:00:00+08:00
- If the text has relative time (e.g. tomorrow, day after tomorrow, this Sunday evening), resolve it by the provided local datetime context.
- If timezone is missing in user text, interpret it in the user's timezone and still output ISO with timezone.`;
}

function getMarkdownPrompt(basePrompt: string): string {
  return `${basePrompt}

Requirements:
- Output only markdown.
- Organize into clear sections and bullet points.
- Include timeline interpretation based on provided local datetime context.
- Keep the writing concise and task-oriented.`;
}

export async function parseTaskContent(input: {
  text: string;
  context: ParseTaskContext;
  attachments?: ParseAttachmentInput[];
}): Promise<ParseTaskArtifacts> {
  const provider = await getConfigValue('llm.provider');
  const baseUrl = await getConfigValue('llm.base_url');
  const apiKey = await getConfigValue('llm.api_key');
  const model = await getConfigValue('llm.model');
  const configuredStructuredPrompt = await getConfigValue('llm.prompt_task_parse_structured');
  const configuredMarkdownPrompt = await getConfigValue('llm.prompt_task_parse_markdown');

  if (!provider || !baseUrl || !apiKey || !model) {
    return {
      structured: fallbackParse(input.text),
      markdown: fallbackMarkdown(input.text),
    };
  }

  try {
    const allowedAttachments = (input.attachments ?? [])
      .slice(0, MAX_AI_ATTACHMENTS)
      .map(toAllowedAttachment)
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const userPromptText = [
      `User timezone setting: ${input.context.userTimezone}`,
      `Current local datetime (with weekday): ${input.context.localNowWithWeekday}`,
      '',
      'Task natural language input:',
      input.text,
    ].join('\n');

    const userMessageContent = [
      ...allowedAttachments,
      {
        type: 'text',
        text: userPromptText,
      },
    ];

    const structuredPrompt = getStructuredPrompt(
      configuredStructuredPrompt?.trim()
        ? configuredStructuredPrompt
        : 'Extract task fields into JSON schema {title,startAt,dueAt,description}.',
    );
    const markdownPrompt = getMarkdownPrompt(
      configuredMarkdownPrompt?.trim()
        ? configuredMarkdownPrompt
        : 'Generate a markdown task brief from the provided text and files.',
    );

    const [structuredRaw, markdownRaw] = await Promise.all([
      callChatCompletions({
        baseUrl,
        apiKey,
        body: {
          model,
          temperature: 0,
          messages: [
            {
              role: 'system',
              content: structuredPrompt,
            },
            {
              role: 'user',
              content: userMessageContent,
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'task_parse_output',
              strict: true,
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  title: { type: ['string', 'null'] },
                  startAt: { type: ['string', 'null'] },
                  dueAt: { type: ['string', 'null'] },
                  description: { type: ['string', 'null'] },
                },
                required: ['title', 'startAt', 'dueAt', 'description'],
              },
            },
          },
        },
      }),
      callChatCompletions({
        baseUrl,
        apiKey,
        body: {
          model,
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content: markdownPrompt,
            },
            {
              role: 'user',
              content: userMessageContent,
            },
          ],
        },
      }),
    ]);

    const fallback = fallbackParse(input.text);

    if (!structuredRaw) {
      return {
        structured: fallback,
        markdown: markdownRaw?.trim() ? markdownRaw.trim() : fallbackMarkdown(input.text),
      };
    }

    const parsed = parseResultSchema.safeParse(JSON.parse(structuredRaw));

    if (!parsed.success) {
      return {
        structured: fallback,
        markdown: markdownRaw?.trim() ? markdownRaw.trim() : fallbackMarkdown(input.text),
      };
    }

    const normalized: ParseTaskResult = {
      title: parsed.data.title?.trim() || null,
      startAt: normalizeParsedDatetime(parsed.data.startAt),
      dueAt: normalizeParsedDatetime(parsed.data.dueAt),
      description: parsed.data.description?.trim() || null,
    };

    return {
      structured: {
        title: normalized.title ?? fallback.title,
        startAt: normalized.startAt,
        dueAt: normalized.dueAt,
        description: normalized.description ?? fallback.description,
      },
      markdown: markdownRaw?.trim() ? markdownRaw.trim() : fallbackMarkdown(input.text),
    };
  } catch {
    return {
      structured: fallbackParse(input.text),
      markdown: fallbackMarkdown(input.text),
    };
  }
}

export async function parseTaskDescription(text: string, context?: ParseTaskContext): Promise<ParseTaskResult> {
  const parsed = await parseTaskContent({
    text,
    context: context ?? buildParseTaskContext('UTC'),
    attachments: [],
  });

  return parsed.structured;
}

export function assertParseInput(text: string) {
  if (!text.trim()) {
    throw new AppError(400, 'INVALID_PARSE_INPUT', 'text is required');
  }
}
