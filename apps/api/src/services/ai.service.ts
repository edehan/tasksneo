import { z } from 'zod';

import { AppError } from '../lib/errors.js';
import { getConfigValue } from './system-config.service.js';

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

function fallbackParse(text: string): ParseTaskResult {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);

  return {
    title: lines[0] ?? null,
    startAt: null,
    dueAt: null,
    description: text || null,
  };
}

export async function parseTaskDescription(text: string): Promise<ParseTaskResult> {
  const provider = await getConfigValue('llm.provider');
  const baseUrl = await getConfigValue('llm.base_url');
  const apiKey = await getConfigValue('llm.api_key');
  const model = await getConfigValue('llm.model');

  if (!provider || !baseUrl || !apiKey || !model) {
    return fallbackParse(text);
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'Extract task fields and respond strictly with JSON: {"title":string|null,"startAt":string|null,"dueAt":string|null,"description":string|null}',
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      return fallbackParse(text);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = json.choices?.[0]?.message?.content;

    if (!content) {
      return fallbackParse(text);
    }

    const parsed = parseResultSchema.safeParse(JSON.parse(content));

    if (!parsed.success) {
      return fallbackParse(text);
    }

    return parsed.data;
  } catch {
    return fallbackParse(text);
  }
}

export function assertParseInput(text: string) {
  if (!text.trim()) {
    throw new AppError(400, 'INVALID_PARSE_INPUT', 'text is required');
  }
}
