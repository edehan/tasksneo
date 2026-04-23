import { randomBytes } from "node:crypto";
import { EmailTokenPurpose, prisma } from "@taskflow/db";

const config = {
	baseUrl: envString("SEED_BASE_URL", "http://api:3001").replace(/\/+$/, ""),
	count: envInt("SEED_COUNT", 100),
	concurrency: envInt("SEED_CONCURRENCY", 10),
	emailDomain: envString("SEED_EMAIL_DOMAIN", "example.com"),
	password: envString("SEED_PASSWORD", "12345678"),
	nicknamePrefix: envString("SEED_NICKNAME_PREFIX", "Random User"),
	classPrefix: envString("SEED_CLASS_PREFIX", "Random Class"),
	classDescription: envString(
		"SEED_CLASS_DESCRIPTION",
		"Created for performance testing",
	),
	timezone: envString("SEED_TIMEZONE", "Asia/Shanghai"),
};

const colors = [
	"#0f766e",
	"#2563eb",
	"#7c3aed",
	"#c2410c",
	"#be123c",
	"#15803d",
	"#4f46e5",
	"#a16207",
];

function envString(name, fallback) {
	const value = process.env[name];
	return value == null || value === "" ? fallback : value;
}

function envInt(name, fallback) {
	const raw = process.env[name];
	if (!raw) return fallback;
	const value = Number(raw);
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${name} must be a positive integer`);
	}
	return value;
}

function randomHex(byteLength = 8) {
	return randomBytes(byteLength).toString("hex");
}

async function requestJson(path, options = {}) {
	const response = await fetch(`${config.baseUrl}${path}`, {
		...options,
		headers: {
			"Content-Type": "application/json",
			...(options.headers ?? {}),
		},
	});
	const text = await response.text();
	let body = null;
	if (text) {
		try {
			body = JSON.parse(text);
		} catch {
			body = { raw: text };
		}
	}

	if (!response.ok) {
		const code = body?.code ? ` ${body.code}` : "";
		const message = body?.error ?? body?.message ?? text;
		throw new Error(
			`${options.method ?? "GET"} ${path} -> ${response.status}${code}: ${message}`,
		);
	}

	return { response, body };
}

function sessionCookieFrom(response) {
	const setCookie = response.headers.get("set-cookie");
	if (!setCookie) {
		throw new Error("Registration response did not include a session cookie");
	}
	const match = setCookie.match(/(?:^|,\s*)(tfses_session=[^;]+)/);
	if (!match) {
		throw new Error(`Could not find tfses_session in Set-Cookie: ${setCookie}`);
	}
	return match[1];
}

async function createRegistrationToken(email) {
	await prisma.emailVerificationToken.deleteMany({
		where: { email, purpose: EmailTokenPurpose.REGISTRATION },
	});

	const token = randomHex(32);
	await prisma.emailVerificationToken.create({
		data: {
			email,
			token,
			purpose: EmailTokenPurpose.REGISTRATION,
			expiresAt: new Date(Date.now() + 60 * 60 * 1000),
		},
	});
	return token;
}

async function completeRegistration(email) {
	const token = await createRegistrationToken(email);
	const { response, body } = await requestJson("/auth/register/complete", {
		method: "POST",
		body: JSON.stringify({
			token,
			password: config.password,
			nickname: `${config.nicknamePrefix} ${randomHex(4)}`,
			timezone: config.timezone,
			trustDevice: false,
		}),
	});

	return {
		user: body.user,
		cookie: sessionCookieFrom(response),
		password: config.password,
	};
}

async function createClass(index, cookie) {
	const name = `${config.classPrefix} ${randomHex(5)}`;
	const { body } = await requestJson("/classes", {
		method: "POST",
		headers: { Cookie: cookie },
		body: JSON.stringify({
			name,
			description: `${config.classDescription} #${index}`,
			color: colors[(index - 1) % colors.length],
		}),
	});

	return body;
}

async function seedOne(index) {
	const email = `${randomHex(10)}@${config.emailDomain}`;
	const account = await completeRegistration(email);
	const classInfo = await createClass(index, account.cookie);

	return {
		index,
		email,
		password: account.password,
		userId: account.user.id,
		classId: classInfo.id,
		className: classInfo.name,
	};
}

async function runPool(items, workerCount, worker) {
	const results = [];
	let cursor = 0;

	async function runWorker() {
		while (cursor < items.length) {
			const item = items[cursor];
			cursor += 1;
			results.push(await worker(item));
		}
	}

	await Promise.all(
		Array.from({ length: Math.min(workerCount, items.length) }, runWorker),
	);

	return results.sort((a, b) => a.index - b.index);
}

async function main() {
	const indices = Array.from({ length: config.count }, (_, offset) => offset + 1);

	console.log(
		JSON.stringify({
			event: "seed_start",
			baseUrl: config.baseUrl,
			count: config.count,
			concurrency: config.concurrency,
			emailPattern: `<random>@${config.emailDomain}`,
		}),
	);

	let completed = 0;
	const startedAt = Date.now();
	const results = await runPool(indices, config.concurrency, async (index) => {
		const result = await seedOne(index);
		completed += 1;
		if (completed % 10 === 0 || completed === config.count) {
			console.log(
				JSON.stringify({
					event: "seed_progress",
					completed,
					count: config.count,
				}),
			);
		}
		return result;
	});

	console.log(
		JSON.stringify({
			event: "seed_done",
			durationMs: Date.now() - startedAt,
			usersCreated: results.length,
			classesCreated: results.length,
		}),
	);
	console.log(
		JSON.stringify({ event: "seed_sample", results: results.slice(0, 5) }),
	);
}

main()
	.catch((error) => {
		console.error(
			JSON.stringify({
				event: "seed_failed",
				error: error instanceof Error ? error.message : String(error),
			}),
		);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
