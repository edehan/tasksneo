import { readFile, writeFile } from "node:fs/promises";

const dbModulePath = process.env.SEED_DB_MODULE_PATH ?? "/app/packages/db/dist/index.js";
const { prisma } = await import(dbModulePath);

const classPoolFile =
	process.env.SEED_CLASS_POOL_FILE ?? "/app/perf/results/class-pool-200.json";
const outputFile =
	process.env.SEED_CLASS_OWNER_OUTPUT_FILE ??
	"/app/perf/results/class-owners-200.json";

async function loadClassIds() {
	const raw = await readFile(classPoolFile, "utf8");
	const parsed = JSON.parse(raw);
	if (!Array.isArray(parsed.classes) || parsed.classes.length === 0) {
		throw new Error(`${classPoolFile} must contain a non-empty classes array`);
	}

	return parsed.classes.map((item) => {
		if (!item.id) {
			throw new Error(`${classPoolFile} contains a class without id`);
		}
		return item.id;
	});
}

async function main() {
	console.log(
		JSON.stringify({
			event: "class_owner_export_start",
			classPoolFile,
			outputFile,
		}),
	);

	const classIds = await loadClassIds();
	const classes = await prisma.class.findMany({
		where: { id: { in: classIds } },
		select: {
			id: true,
			name: true,
			inviteCode: true,
			ownerId: true,
			owner: {
				select: {
					email: true,
					nickname: true,
				},
			},
		},
	});

	const byId = new Map(classes.map((item) => [item.id, item]));
	const owners = classIds.map((classId) => {
		const item = byId.get(classId);
		if (!item) {
			throw new Error(`Class not found in database: ${classId}`);
		}

		return {
			classId: item.id,
			className: item.name,
			inviteCode: item.inviteCode,
			ownerId: item.ownerId,
			ownerEmail: item.owner.email,
			ownerNickname: item.owner.nickname,
			ownerPassword: "12345678",
		};
	});

	await writeFile(
		outputFile,
		`${JSON.stringify({ owners }, null, 2)}\n`,
		"utf8",
	);

	console.log(
		JSON.stringify({
			event: "class_owner_export_done",
			classes: owners.length,
			outputFile,
		}),
	);
}

main()
	.catch((error) => {
		console.error(
			JSON.stringify({
				event: "class_owner_export_failed",
				error: error instanceof Error ? error.message : String(error),
			}),
		);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
