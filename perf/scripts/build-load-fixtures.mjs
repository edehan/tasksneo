import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const dbModulePath = process.env.SEED_DB_MODULE_PATH ?? "/app/packages/db/dist/index.js";
const { prisma } = await import(dbModulePath);

const config = {
	usersFile: process.env.FIXTURE_USERS_FILE ?? "/app/perf/results/full-seed/users.json",
	classesFile:
		process.env.FIXTURE_PUBLIC_CLASSES_FILE ??
		"/app/perf/results/full-seed/public-classes.json",
	outputFile: process.env.FIXTURE_OUTPUT_FILE ?? "/app/perf/results/load-fixtures.json",
	submissionLimit: envInt("FIXTURE_SUBMISSION_LIMIT", 50000),
};

function envInt(name, fallback) {
	const raw = process.env[name];
	if (!raw) return fallback;
	const value = Number(raw);
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${name} must be a positive integer`);
	}
	return value;
}

async function readJson(path) {
	return JSON.parse(await readFile(path, "utf8"));
}

async function main() {
	console.log(JSON.stringify({ event: "fixture_build_start", ...config }));

	const [{ users }, { classes: publicClasses }] = await Promise.all([
		readJson(config.usersFile),
		readJson(config.classesFile),
	]);

	if (!Array.isArray(users) || users.length === 0) {
		throw new Error(`${config.usersFile} must contain a non-empty users array`);
	}
	if (!Array.isArray(publicClasses) || publicClasses.length === 0) {
		throw new Error(`${config.classesFile} must contain a non-empty classes array`);
	}

	const [memberships, tasks, submissions] = await Promise.all([
		prisma.classMember.findMany({
			where: { classId: { in: publicClasses.map((item) => item.id) } },
			select: {
				userId: true,
				role: true,
				class: {
					select: {
						id: true,
						name: true,
						inviteCode: true,
						ownerId: true,
					},
				},
			},
		}),
		prisma.task.findMany({
			where: {
				classId: { in: publicClasses.map((item) => item.id) },
				deletedAt: null,
				isPublished: true,
			},
			select: {
				id: true,
				classId: true,
				title: true,
				createdBy: true,
				dueAt: true,
			},
		}),
		prisma.submission.findMany({
			take: config.submissionLimit,
			orderBy: { firstSubmittedAt: "desc" },
			select: {
				id: true,
				taskId: true,
				userId: true,
			},
		}),
	]);

	const classById = new Map(publicClasses.map((item) => [item.id, item]));
	const classTasks = {};
	const taskSubmissions = {};
	const userAccess = {};

	for (const task of tasks) {
		if (!task.classId) continue;
		if (!classTasks[task.classId]) classTasks[task.classId] = [];
		classTasks[task.classId].push({
			id: task.id,
			classId: task.classId,
			title: task.title,
			createdBy: task.createdBy,
			dueAt: task.dueAt?.toISOString() ?? null,
		});
	}

	for (const submission of submissions) {
		if (!taskSubmissions[submission.taskId]) taskSubmissions[submission.taskId] = [];
		taskSubmissions[submission.taskId].push(submission);
	}

	for (const membership of memberships) {
		const item = classById.get(membership.class.id);
		if (!item) continue;
		if (!userAccess[membership.userId]) userAccess[membership.userId] = { classes: [] };
		userAccess[membership.userId].classes.push({
			id: membership.class.id,
			name: membership.class.name,
			inviteCode: membership.class.inviteCode,
			ownerId: membership.class.ownerId,
			role: membership.role,
			ownerEmail: item.ownerEmail,
			ownerPassword: item.ownerPassword,
		});
	}

	const fixture = {
		generatedAt: new Date().toISOString(),
		users,
		publicClasses,
		tasks,
		submissions,
		userAccess,
		classTasks,
		taskSubmissions,
		summary: {
			users: users.length,
			publicClasses: publicClasses.length,
			memberships: memberships.length,
			tasks: tasks.length,
			submissions: submissions.length,
		},
	};

	await mkdir(dirname(config.outputFile), { recursive: true });
	await writeFile(config.outputFile, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");

	console.log(JSON.stringify({ event: "fixture_build_done", outputFile: config.outputFile, ...fixture.summary }));
}

main()
	.catch((error) => {
		console.error(
			JSON.stringify({
				event: "fixture_build_failed",
				error: error instanceof Error ? error.message : String(error),
			}),
		);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
