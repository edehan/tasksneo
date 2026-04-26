import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

const dbModulePath = process.env.SEED_DB_MODULE_PATH ?? "/app/packages/db/dist/index.js";
const bcryptModulePath =
	process.env.SEED_BCRYPT_MODULE_PATH ?? "/app/apps/api/node_modules/bcryptjs/index.js";
const { prisma } = await import(dbModulePath);
const bcrypt = await import(bcryptModulePath);

const dayMs = 24 * 60 * 60 * 1000;
const password = "12345678";

const config = {
	confirmReset: process.env.FULL_SEED_CONFIRM_RESET,
	userCount: envInt("FULL_SEED_USER_COUNT", 5000),
	publicClassCount: envInt("FULL_SEED_PUBLIC_CLASS_COUNT", 200),
	minClassesPerUser: envInt("FULL_SEED_MIN_CLASSES_PER_USER", 3),
	maxClassesPerUser: envInt("FULL_SEED_MAX_CLASSES_PER_USER", 10),
	minTasksPerClass: envInt("FULL_SEED_MIN_TASKS_PER_CLASS", 3),
	maxTasksPerClass: envInt("FULL_SEED_MAX_TASKS_PER_CLASS", 10),
	taskStartMinDaysFromNow: envInt("FULL_SEED_TASK_START_MIN_DAYS_FROM_NOW", -30),
	taskStartMaxDaysFromNow: envInt("FULL_SEED_TASK_START_MAX_DAYS_FROM_NOW", 2),
	taskDueMinDaysFromNow: envInt("FULL_SEED_TASK_DUE_MIN_DAYS_FROM_NOW", 3),
	taskDueMaxDaysFromNow: envInt("FULL_SEED_TASK_DUE_MAX_DAYS_FROM_NOW", 15),
	taskBodyMinWords: envInt("FULL_SEED_TASK_BODY_MIN_WORDS", 200),
	taskBodyMaxWords: envInt("FULL_SEED_TASK_BODY_MAX_WORDS", 1000),
	outputDir: process.env.FULL_SEED_OUTPUT_DIR ?? "/app/perf/results/full-seed",
};

const words = [
	"ability", "academy", "account", "active", "adapt", "advance", "agency", "analysis", "answer", "archive",
	"argument", "article", "aspect", "assign", "attempt", "balance", "baseline", "behavior", "benefit", "boundary",
	"brief", "budget", "capacity", "capture", "careful", "category", "chapter", "choice", "clarity", "classroom",
	"client", "combine", "comment", "community", "compare", "complete", "concept", "confirm", "connect", "context",
	"contrast", "control", "create", "culture", "current", "dataset", "deadline", "decision", "define", "deliver",
	"design", "detail", "develop", "diagram", "digital", "direct", "document", "draft", "dynamic", "economy",
	"editor", "effect", "effort", "element", "energy", "engage", "environment", "evidence", "example", "exchange",
	"explain", "explore", "factor", "feature", "feedback", "field", "figure", "filter", "final", "focus",
	"format", "framework", "function", "future", "general", "generate", "global", "grade", "group", "growth",
	"handle", "history", "identify", "impact", "include", "increase", "index", "industry", "input", "insight",
	"instance", "integrate", "interface", "interpret", "issue", "journal", "keyword", "language", "layout", "lecture",
	"lesson", "logic", "manage", "market", "material", "measure", "member", "method", "model", "module",
	"network", "notice", "objective", "observe", "option", "output", "pattern", "perform", "period", "policy",
	"practice", "prepare", "present", "process", "product", "profile", "project", "prompt", "purpose", "quality",
	"question", "record", "reduce", "reflect", "region", "release", "report", "request", "research", "resource",
	"response", "review", "sample", "schedule", "school", "section", "select", "service", "session", "signal",
	"solution", "source", "stable", "status", "strategy", "student", "study", "subject", "submit", "summary",
	"support", "system", "teacher", "template", "theory", "timeline", "topic", "transfer", "update", "value",
	"variable", "version", "visual", "workflow", "writing", "argumentation", "assessment", "collaboration", "constraint",
	"criterion", "distribution", "evaluation", "implementation", "instruction", "iteration", "measurement", "observation",
	"participation", "perspective", "presentation", "relationship", "representation", "requirement", "simulation", "specification",
	"transformation", "verification",
];

const colors = [
	"#0f766e", "#2563eb", "#7c3aed", "#c2410c", "#be123c",
	"#15803d", "#4f46e5", "#a16207", "#0891b2", "#4338ca",
];

function envInt(name, fallback) {
	const raw = process.env[name];
	if (!raw) return fallback;
	const value = Number(raw);
	if (!Number.isInteger(value)) throw new Error(`${name} must be an integer`);
	return value;
}

function randomHex(bytes = 5) {
	return randomBytes(bytes).toString("hex");
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

function randomWords(count) {
	return Array.from({ length: count }, () => randomItem(words)).join(" ");
}

function randomInviteCode() {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	let code = "";
	for (const byte of randomBytes(10)) code += alphabet[byte % alphabet.length];
	return code;
}

function randomDateBetween(start, end) {
	const startMs = start.getTime();
	const endMs = end.getTime();
	if (endMs <= startMs) return start;
	return new Date(startMs + Math.floor(Math.random() * (endMs - startMs)));
}

function buildTask(classInfo, sequence) {
	const now = Date.now();
	const dueAt = new Date(
		now + randomInt(config.taskDueMinDaysFromNow, config.taskDueMaxDaysFromNow) * dayMs,
	);
	const startWindowStart = new Date(now + config.taskStartMinDaysFromNow * dayMs);
	const configuredStartWindowEnd = new Date(now + config.taskStartMaxDaysFromNow * dayMs);
	const startWindowEnd = new Date(
		Math.min(configuredStartWindowEnd.getTime(), dueAt.getTime() - 60 * 60 * 1000),
	);
	const bodyWordCount = randomInt(config.taskBodyMinWords, config.taskBodyMaxWords);
	const topic = `${randomItem(words)} ${randomItem(words)}`;
	const id = randomUUID();

	return {
		id,
		classId: classInfo.id,
		createdBy: classInfo.ownerId,
		title: `Task ${sequence} ${topic} ${randomHex(3)}`,
		description: randomWords(randomInt(24, 60)),
		sourceText: randomWords(bodyWordCount),
		startAt: randomDateBetween(startWindowStart, startWindowEnd),
		dueAt,
		allowLateSubmission: Math.random() < 0.75,
		blockedBy: [],
		isPublished: true,
		publishedAt: new Date(),
	};
}

function chunk(items, size) {
	const result = [];
	for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
	return result;
}

async function createManyInChunks(model, data, size = 1000) {
	for (const part of chunk(data, size)) {
		await model.createMany({ data: part });
	}
}

async function resetDatabase() {
	if (config.confirmReset !== "YES") {
		throw new Error("Set FULL_SEED_CONFIRM_RESET=YES to wipe and reseed the database");
	}

	await prisma.$executeRawUnsafe(`
		TRUNCATE TABLE
			attachments,
			comments,
			email_verification_tokens,
			mcp_keys,
			notification_jobs,
			sessions,
			site_announcements,
			submissions,
			task_user_state,
			tasks,
			class_members,
			classes,
			user_credentials,
			user_notification_prefs,
			users,
			schools,
			system_config
		RESTART IDENTITY CASCADE
	`);
}

async function main() {
	if (config.publicClassCount > config.userCount) {
		throw new Error("FULL_SEED_PUBLIC_CLASS_COUNT cannot exceed FULL_SEED_USER_COUNT");
	}
	if (config.minClassesPerUser > config.maxClassesPerUser) {
		throw new Error("FULL_SEED_MIN_CLASSES_PER_USER cannot exceed FULL_SEED_MAX_CLASSES_PER_USER");
	}
	if (config.minTasksPerClass > config.maxTasksPerClass) {
		throw new Error("FULL_SEED_MIN_TASKS_PER_CLASS cannot exceed FULL_SEED_MAX_TASKS_PER_CLASS");
	}

	const startedAt = Date.now();
	console.log(JSON.stringify({ event: "full_seed_start", ...config }));

	await mkdir(config.outputDir, { recursive: true });
	await resetDatabase();
	console.log(JSON.stringify({ event: "database_reset_done" }));

	const passwordHash = await bcrypt.hash(password, 10);
	const users = Array.from({ length: config.userCount }, (_, index) => ({
		id: randomUUID(),
		email: `${randomHex(10)}@example.com`,
		nickname: `Seed User ${index + 1}`,
		timezone: "Asia/Shanghai",
	}));

	await createManyInChunks(prisma.user, users.map((user) => ({
		id: user.id,
		email: user.email,
		nickname: user.nickname,
		timezone: user.timezone,
	})));
	await createManyInChunks(prisma.userCredential, users.map((user) => ({
		userId: user.id,
		provider: "LOCAL",
		passwordHash,
	})));
	console.log(JSON.stringify({ event: "users_created", users: users.length }));

	const personalClasses = users.map((user) => ({
		id: randomUUID(),
		name: "个人空间",
		isPersonal: true,
		inviteCode: null,
		ownerId: user.id,
		color: "#6366f1",
	}));
	await createManyInChunks(prisma.class, personalClasses);
	await createManyInChunks(prisma.classMember, personalClasses.map((item) => ({
		classId: item.id,
		userId: item.ownerId,
		role: "OWNER",
	})));
	console.log(JSON.stringify({ event: "personal_classes_created", classes: personalClasses.length }));

	const ownerUsers = users.slice(0, config.publicClassCount);
	const publicClasses = ownerUsers.map((user, index) => ({
		id: randomUUID(),
		name: `Public Class ${index + 1} ${randomHex(3)}`,
		description: randomWords(randomInt(16, 40)),
		color: colors[index % colors.length],
		isPersonal: false,
		inviteCode: randomInviteCode(),
		ownerId: user.id,
		ownerEmail: user.email,
		ownerPassword: password,
	}));

	await createManyInChunks(prisma.class, publicClasses.map((item) => ({
		id: item.id,
		name: item.name,
		description: item.description,
		color: item.color,
		isPersonal: false,
		inviteCode: item.inviteCode,
		ownerId: item.ownerId,
	})));
	console.log(JSON.stringify({ event: "public_classes_created", classes: publicClasses.length }));

	const publicMemberships = [];
	for (const user of users) {
		const targetCount = randomInt(config.minClassesPerUser, config.maxClassesPerUser);
		const ownedPublicClass = publicClasses.find((item) => item.ownerId === user.id);
		const selected = ownedPublicClass ? [ownedPublicClass] : [];
		const candidates = publicClasses.filter((item) => item.ownerId !== user.id);
		for (const item of shuffle(candidates).slice(0, targetCount - selected.length)) {
			selected.push(item);
		}
		for (const item of selected) {
			publicMemberships.push({
				classId: item.id,
				userId: user.id,
				role: item.ownerId === user.id ? "OWNER" : "MEMBER",
			});
		}
	}
	await createManyInChunks(prisma.classMember, publicMemberships, 5000);
	console.log(JSON.stringify({ event: "public_memberships_created", memberships: publicMemberships.length }));

	const tasks = [];
	const taskOutputs = [];
	for (const classInfo of publicClasses) {
		const count = randomInt(config.minTasksPerClass, config.maxTasksPerClass);
		for (let i = 1; i <= count; i += 1) {
			const task = buildTask(classInfo, i);
			tasks.push(task);
			taskOutputs.push({
				id: task.id,
				classId: task.classId,
				className: classInfo.name,
				ownerId: classInfo.ownerId,
				ownerEmail: classInfo.ownerEmail,
				ownerPassword: password,
				title: task.title,
				startAt: task.startAt.toISOString(),
				dueAt: task.dueAt.toISOString(),
			});
		}
	}
	await createManyInChunks(prisma.task, tasks, 1000);
	console.log(JSON.stringify({ event: "tasks_created", tasks: tasks.length }));

	const userOutput = users.map((user) => ({
		id: user.id,
		email: user.email,
		password,
		nickname: user.nickname,
	}));
	const classOutput = publicClasses.map((item) => ({
		id: item.id,
		name: item.name,
		inviteCode: item.inviteCode,
		ownerId: item.ownerId,
		ownerEmail: item.ownerEmail,
		ownerPassword: item.ownerPassword,
		taskCount: taskOutputs.filter((task) => task.classId === item.id).length,
	}));

	await Promise.all([
		writeFile(`${config.outputDir}/users.json`, `${JSON.stringify({ users: userOutput }, null, 2)}\n`, "utf8"),
		writeFile(`${config.outputDir}/public-classes.json`, `${JSON.stringify({ classes: classOutput }, null, 2)}\n`, "utf8"),
	]);

	console.log(JSON.stringify({
		event: "full_seed_done",
		durationMs: Date.now() - startedAt,
		outputDir: config.outputDir,
		files: ["users.json", "public-classes.json"],
		users: users.length,
		publicClasses: publicClasses.length,
		publicMemberships: publicMemberships.length,
		tasks: tasks.length,
	}));
}

main()
	.catch((error) => {
		console.error(JSON.stringify({
			event: "full_seed_failed",
			error: error instanceof Error ? error.message : String(error),
		}));
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
