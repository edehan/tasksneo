# LLM Parse Experiment

This directory contains a small thesis experiment for task-description parsing.
It compares the same model under three conditions:

1. no local time context in the prompt;
2. local time context in the prompt;
3. the second result after system-side datetime filtering.

The experiment uses `alibaba/qwen3.6-27b` through an Anthropic Messages API
compatible endpoint with JSON Schema structured output.

## Run

From the repository root:

```bash
node perf/llm-parse/run.mjs
```

To rerun only selected cases and merge them into `results/latest.*`:

```bash
LLM_PARSE_CASE_IDS=T01,T19 node perf/llm-parse/run.mjs
```

The script reads credentials from `.env`:

- `DEV_SEED_LLM_BASE_URL`
- `DEV_SEED_LLM_API_KEY`

`DEV_SEED_LLM_MODEL` is intentionally ignored because this experiment fixes the
model to `alibaba/qwen3.6-27b`.

## Inputs

`cases.json` contains 20 expanded Chinese teacher-task descriptions. The
`excerpt` field is meant for the thesis table. The full `text` field is kept in
the experiment record so the paper does not need to include long or sensitive
source text.

The fixed local context is:

```text
Timezone: Asia/Shanghai
Now: 2026-04-16 21:29:00 (Thursday, GMT+8)
```

## Outputs

The script writes:

- `results/latest.json`: complete raw model output, filtered output, expected
  labels, and field-level evaluation.
- `results/latest.md`: Markdown tables that can be copied into the thesis draft.

API keys are never written to result files.

## Evaluation Symbols

- `✓`: field parsed correctly.
- `×`: field parsed incorrectly.
- `—`: the source text does not contain this field, so it is not counted.
- `F`: model call or structured parsing failed.
- `置空`: the system filter actively set the field to `null`.

Date granularity is not scored separately. If the parsed value captures the
annotated datetime semantics, it is counted as correct.

## Filtering Rules

The filtered group reuses the local-time model output and applies the same
business cleanup used by the application:

- invalid ISO 8601 datetime strings become `null`;
- if `startAt > dueAt`, both fields in that time option become `null`;
- if `startAt === dueAt`, `startAt` becomes `null` and `dueAt` is preserved.
