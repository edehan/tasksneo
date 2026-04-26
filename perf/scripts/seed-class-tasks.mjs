import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const dbModulePath = process.env.SEED_DB_MODULE_PATH ?? "/app/packages/db/dist/index.js";
const { prisma } = await import(dbModulePath);

const dayMs = 24 * 60 * 60 * 1000;

const config = {
	classPoolFile:
		process.env.SEED_CLASS_POOL_FILE ?? "/app/perf/results/class-pool-200.json",
	minTasksPerClass: envInt("SEED_TASKS_MIN_PER_CLASS", 5),
	maxTasksPerClass: envInt("SEED_TASKS_MAX_PER_CLASS", 10),
	startMinDaysFromNow: envInt("SEED_TASK_START_MIN_DAYS_FROM_NOW", -30),
	startMaxDaysFromNow: envInt("SEED_TASK_START_MAX_DAYS_FROM_NOW", 1),
	dueMinDaysFromNow: envInt("SEED_TASK_DUE_MIN_DAYS_FROM_NOW", 3),
	dueMaxDaysFromNow: envInt("SEED_TASK_DUE_MAX_DAYS_FROM_NOW", 15),
	titlePrefix: envString("SEED_TASK_TITLE_PREFIX", "Performance Task"),
	outputFile:
		process.env.SEED_TASK_OUTPUT_FILE ?? "/app/perf/results/class-tasks.json",
};

const topics = [
	"reading reflection",
	"case analysis",
	"lab report",
	"design proposal",
	"short essay",
	"weekly quiz",
	"peer review",
	"project checkpoint",
	"data interpretation",
	"concept map",
];

const verbs = [
	"Compare",
	"Summarize",
	"Evaluate",
	"Explain",
	"Design",
	"Analyze",
	"Revise",
	"Prepare",
	"Investigate",
	"Document",
];

function envString(name, fallback) {
	const value = process.env[name];
	return value == null || value === "" ? fallback : value;
}

function envInt(name, fallback) {
	const raw = process.env[name];
	if (!raw) return fallback;
	const value = Number(raw);
	if (!Number.isInteger(value)) {
		throw new Error(`${name} must be an integer`);
	}
	return value;
}

function randomHex(byteLength = 4) {
	return randomBytes(byteLength).toString("hex");
}

function randomInt(min, max) {
	return min + Math.floor(Math.random() * (max - min + 1));
}

function randomItem(items) {
	return items[randomInt(0, items.length - 1)];
}

function randomDateBetween(start, end) {
	const startMs = start.getTime();
	const endMs = end.getTime();
	if (endMs <= startMs) return start;
	return new Date(startMs + Math.floor(Math.random() * (endMs - startMs)));
}

function buildTaskPayload(classInfo, taskNumber) {
	const now = Date.now();
	const dueAt = new Date(
		now + randomInt(config.dueMinDaysFromNow, config.dueMaxDaysFromNow) * dayMs,
	);
	const startWindowStart = new Date(
		now + config.startMinDaysFromNow * dayMs,
	);
	const configuredStartWindowEnd = new Date(
		now + config.startMaxDaysFromNow * dayMs,
	);
	const startWindowEnd = new Date(
		Math.min(configuredStartWindowEnd.getTime(), dueAt.getTime() - 60 * 60 * 1000),
	);
	const startAt = randomDateBetween(startWindowStart, startWindowEnd);
	const topic = randomItem(topics);
	const verb = randomItem(verbs);
	const code = randomHex(3);

	return {
		classId: classInfo.id,
		createdBy: classInfo.ownerId,
		title: `${config.titlePrefix} ${taskNumber} ${code}`,
		description: `${verb} the ${topic} for ${classInfo.name}. Include concrete evidence, a short conclusion, and any questions that remain unclear.`,
		sourceText: [
			`Context: ${classInfo.name}`,
			`Prompt: ${verb} the assigned ${topic}.`,
			`Reference code: ${code}`,
			"Submission format: concise markdown notes are acceptable.",
		].join("\n"),
		startAt,
		dueAt,
		allowLateSubmission: Math.random() < 0.75,
		blockedBy: [],
		isPublished: true,
		publishedAt: new Date(),
	};
}

async function loadClassPool() {
	const raw = await readFile(config.classPoolFile, "utf8");
	const parsed = JSON.parse(raw);
	if (!Array.isArray(parsed.classes) || parsed.classes.length === 0) {
		throw new Error(`${config.classPoolFile} must contain a non-empty classes array`);
	}
	return parsed.classes;
}

async function main() {
	if (config.minTasksPerClass > config.maxTasksPerClass) {
		throw new Error("SEED_TASKS_MIN_PER_CLASS cannot exceed SEED_TASKS_MAX_PER_CLASS");
	}

	console.log(
		JSON.stringify({
			event: "task_seed_start",
			classPoolFile: config.classPoolFile,
			minTasksPerClass: config.minTasksPerClass,
			maxTasksPerClass: config.maxTasksPerClass,
			startMinDaysFromNow: config.startMinDaysFromNow,
			startMaxDaysFromNow: config.startMaxDaysFromNow,
			dueMinDaysFromNow: config.dueMinDaysFromNow,
			dueMaxDaysFromNow: config.dueMaxDaysFromNow,
			outputFile: config.outputFile,
		}),
	);

	const startedAt = Date.now();
	const classes = await loadClassPool();
	const createdTasks = [];

	for (let i = 0; i < classes.length; i += 1) {
		const classInfo = classes[i];
		const taskCount = randomInt(config.minTasksPerClass, config.maxTasksPerClass);
		const tasks = Array.from({ length: taskCount }, (_, offset) =>
			buildTaskPayload(classInfo, offset + 1),
		);

		for (const task of tasks) {
			const created = await prisma.task.create({
				data: task,
				select: { id: true },
			});

			createdTasks.push({
				id: created.id,
				classId: task.classId,
				className: classInfo.name,
				createdBy: task.createdBy,
				ownerEmail: classInfo.ownerEmail ?? null,
				ownerPassword: classInfo.ownerPassword ?? "12345678",
				title: task.title,
				startAt: task.startAt.toISOString(),
				dueAt: task.dueAt.toISOString(),
			});
		}

		const completed = i + 1;
		if (completed % 25 === 0 || completed === classes.length) {
			console.log(
				JSON.stringify({
					event: "task_seed_progress",
					completedClasses: completed,
					totalClasses: classes.length,
					tasksCreated: createdTasks.length,
				}),
			);
		}
	}

	await writeFile(
		config.outputFile,
		`${JSON.stringify({ tasks: createdTasks }, null, 2)}\n`,
		"utf8",
	);

	console.log(
		JSON.stringify({
			event: "task_seed_done",
			durationMs: Date.now() - startedAt,
			classes: classes.length,
			tasksCreated: createdTasks.length,
			outputFile: config.outputFile,
		}),
	);
}

main()
	.catch((error) => {
		console.error(
			JSON.stringify({
				event: "task_seed_failed",
				error: error instanceof Error ? error.message : String(error),
			}),
		);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
