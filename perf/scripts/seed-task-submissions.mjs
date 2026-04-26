import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const dbModulePath = process.env.SEED_DB_MODULE_PATH ?? "/app/packages/db/dist/index.js";
const { prisma } = await import(dbModulePath);

const config = {
	minSubmissionsPerTask: envInt("SEED_MIN_SUBMISSIONS_PER_TASK", 5),
	maxSubmissionsPerTask: envInt("SEED_MAX_SUBMISSIONS_PER_TASK", 20),
	outputFile:
		process.env.SEED_SUBMISSION_OUTPUT_FILE ??
		"/app/perf/results/full-seed/submissions.json",
};

const words = [
	"analysis", "argument", "context", "evidence", "reflection", "summary", "design", "process",
	"comparison", "interpretation", "concept", "method", "result", "question", "solution", "example",
	"observation", "practice", "response", "framework", "detail", "pattern", "reason", "conclusion",
];

function envInt(name, fallback) {
	const raw = process.env[name];
	if (!raw) return fallback;
	const value = Number(raw);
	if (!Number.isInteger(value) || value < 0) {
		throw new Error(`${name} must be a non-negative integer`);
	}
	return value;
}

function randomInt(min, max) {
	return min + Math.floor(Math.random() * (max - min + 1));
}

function randomItem(items) {
	return items[randomInt(0, items.length - 1)];
}

function shuffle(items) {
	const result = [...items];
	for (let i = result.length - 1; i > 0; i -= 1) {
		const j = randomInt(0, i);
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

function randomText(minWords = 40, maxWords = 160) {
	const count = randomInt(minWords, maxWords);
	const body = Array.from({ length: count }, () => randomItem(words)).join(" ");
	return `${body}. Reference ${randomBytes(3).toString("hex")}.`;
}

function chunk(items, size) {
	const result = [];
	for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
	return result;
}

async function main() {
	if (config.minSubmissionsPerTask > config.maxSubmissionsPerTask) {
		throw new Error("SEED_MIN_SUBMISSIONS_PER_TASK cannot exceed SEED_MAX_SUBMISSIONS_PER_TASK");
	}

	console.log(JSON.stringify({ event: "submission_seed_start", ...config }));

	const tasks = await prisma.task.findMany({
		where: {
			classId: { not: null },
			deletedAt: null,
			isPublished: true,
		},
		select: {
			id: true,
			classId: true,
			class: {
				select: {
					members: {
						where: { role: "MEMBER" },
						select: { userId: true },
					},
				},
			},
		},
	});

	const submissions = [];
	const states = [];
	for (const task of tasks) {
		const memberIds = task.class?.members.map((item) => item.userId) ?? [];
		if (memberIds.length === 0) continue;
		const count = Math.min(
			randomInt(config.minSubmissionsPerTask, config.maxSubmissionsPerTask),
			memberIds.length,
		);
		for (const userId of shuffle(memberIds).slice(0, count)) {
			const now = new Date();
			submissions.push({
				id: randomUUID(),
				taskId: task.id,
				userId,
				content: randomText(),
				firstSubmittedAt: now,
			});
			states.push({
				taskId: task.id,
				userId,
				tags: [],
				viewedAt: now,
			});
		}
	}

	await prisma.submission.deleteMany({
		where: { taskId: { in: tasks.map((item) => item.id) } },
	});

	for (const part of chunk(submissions, 1000)) {
		await prisma.submission.createMany({ data: part, skipDuplicates: true });
	}
	for (const part of chunk(states, 1000)) {
		await prisma.taskUserState.createMany({ data: part, skipDuplicates: true });
	}

	await mkdir(dirname(config.outputFile), { recursive: true });
	await writeFile(
		config.outputFile,
		`${JSON.stringify(
			{
				submissions: submissions.map((item) => ({
					id: item.id,
					taskId: item.taskId,
					userId: item.userId,
				})),
			},
			null,
			2,
		)}\n`,
		"utf8",
	);

	console.log(
		JSON.stringify({
			event: "submission_seed_done",
			tasks: tasks.length,
			submissions: submissions.length,
			outputFile: config.outputFile,
		}),
	);
}

main()
	.catch((error) => {
		console.error(
			JSON.stringify({
				event: "submission_seed_failed",
				error: error instanceof Error ? error.message : String(error),
			}),
		);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
