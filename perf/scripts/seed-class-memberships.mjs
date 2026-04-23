import { writeFile } from "node:fs/promises";

const dbModulePath = process.env.SEED_DB_MODULE_PATH ?? "/app/packages/db/dist/index.js";
const { prisma } = await import(dbModulePath);

const config = {
	poolClassCount: envInt("SEED_POOL_CLASS_COUNT", 200),
	joinClassesPerUser: envInt("SEED_JOIN_CLASSES_PER_USER", 5),
	outputFile:
		process.env.SEED_CLASS_POOL_OUTPUT_FILE ??
		"/app/perf/results/class-pool-200.json",
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

function shuffle(items) {
	const result = [...items];
	for (let i = result.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

function pickMany(items, count) {
	if (count > items.length) {
		throw new Error(`Cannot pick ${count} items from ${items.length} candidates`);
	}
	return shuffle(items).slice(0, count);
}

async function loadClassPool() {
	const classes = await prisma.class.findMany({
		where: {
			isPersonal: false,
			inviteCode: { not: null },
		},
		select: {
			id: true,
			name: true,
			inviteCode: true,
			ownerId: true,
			owner: {
				select: {
					email: true,
				},
			},
			createdAt: true,
		},
	});

	if (classes.length < config.poolClassCount) {
		throw new Error(
			`Need at least ${config.poolClassCount} non-personal classes, found ${classes.length}`,
		);
	}

	return pickMany(classes, config.poolClassCount);
}

async function loadUsers() {
	return prisma.user.findMany({
		where: { isActive: true },
		select: {
			id: true,
			email: true,
			nickname: true,
		},
	});
}

async function seedMemberships(users, classPool) {
	let membershipsCreated = 0;
	let membershipsSkipped = 0;

	for (let i = 0; i < users.length; i += 1) {
		const user = users[i];
		const candidates = classPool.filter((item) => item.ownerId !== user.id);
		const selected = pickMany(candidates, config.joinClassesPerUser);

		const result = await prisma.classMember.createMany({
			data: selected.map((item) => ({
				classId: item.id,
				userId: user.id,
				role: "MEMBER",
			})),
			skipDuplicates: true,
		});

		membershipsCreated += result.count;
		membershipsSkipped += selected.length - result.count;

		const completed = i + 1;
		if (completed % 250 === 0 || completed === users.length) {
			console.log(
				JSON.stringify({
					event: "membership_progress",
					completedUsers: completed,
					totalUsers: users.length,
					membershipsCreated,
					membershipsSkipped,
				}),
			);
		}
	}

	return { membershipsCreated, membershipsSkipped };
}

async function main() {
	console.log(
		JSON.stringify({
			event: "membership_seed_start",
			poolClassCount: config.poolClassCount,
			joinClassesPerUser: config.joinClassesPerUser,
			outputFile: config.outputFile,
		}),
	);

	const startedAt = Date.now();
	const [classPool, users] = await Promise.all([loadClassPool(), loadUsers()]);

	if (classPool.length < config.joinClassesPerUser + 1) {
		throw new Error(
			`Class pool must contain more than ${config.joinClassesPerUser} classes`,
		);
	}

	await writeFile(
		config.outputFile,
		`${JSON.stringify(
			{
				classes: classPool.map((item) => ({
					id: item.id,
					name: item.name,
					inviteCode: item.inviteCode,
					ownerId: item.ownerId,
					ownerEmail: item.owner.email,
					ownerPassword: "12345678",
					createdAt: item.createdAt.toISOString(),
				})),
			},
			null,
			2,
		)}\n`,
		"utf8",
	);

	const summary = await seedMemberships(users, classPool);

	console.log(
		JSON.stringify({
			event: "membership_seed_done",
			durationMs: Date.now() - startedAt,
			users: users.length,
			classPool: classPool.length,
			classPoolOutputFile: config.outputFile,
			...summary,
		}),
	);
}

main()
	.catch((error) => {
		console.error(
			JSON.stringify({
				event: "membership_seed_failed",
				error: error instanceof Error ? error.message : String(error),
			}),
		);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
