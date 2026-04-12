import { prisma } from "@taskflow/db";
import type { Logger } from "pino";

const DEFAULT_SLOW_QUERY_MS = 200;

function parseThreshold(): number {
	const raw = process.env.SLOW_QUERY_MS;
	if (!raw) return DEFAULT_SLOW_QUERY_MS;
	const n = Number(raw);
	return Number.isFinite(n) && n >= 0 ? n : DEFAULT_SLOW_QUERY_MS;
}

export function instrumentPrisma(logger: Logger): void {
	const slowQueryMs = parseThreshold();
	const logParams = process.env.LOG_PRISMA_PARAMS === "true";

	// Prisma's `log: [{ emit: 'event', ... }]` config gives us a typed `$on` API.
	// The `query` event fires for every SQL statement with a duration in ms.
	prisma.$on("query", (e) => {
		if (e.duration < slowQueryMs) return;
		logger.warn(
			{
				query: e.query,
				duration_ms: e.duration,
				params_length: e.params?.length ?? 0,
				params: logParams ? e.params : undefined,
				target: e.target,
			},
			"prisma_slow_query",
		);
	});

	prisma.$on("warn", (e) => {
		logger.warn({ target: e.target, message: e.message }, "prisma_warn");
	});

	prisma.$on("error", (e) => {
		logger.error({ target: e.target, message: e.message }, "prisma_error");
	});

	logger.info(
		{ slowQueryMs, logParams },
		"prisma_instrumented",
	);
}
