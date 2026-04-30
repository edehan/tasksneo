#!/usr/bin/env node
import { mkdir, readFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "../..");
const defaultOutput = resolve(repoRoot, "docs/database-erd.md");
const require = createRequire(import.meta.url);

async function loadGenerator() {
	const generatorRoot = await realpath(
		resolve(packageRoot, "node_modules/prisma-erd-generator"),
	);
	const { default: generateErd } = require(
		resolve(generatorRoot, "dist/generate.cjs"),
	);
	return generateErd;
}

function respond(response) {
	process.stderr.write(`${JSON.stringify(response)}\n`);
}

function resolveOutput(output) {
	if (!output) {
		return defaultOutput;
	}
	return isAbsolute(output) ? output : resolve(packageRoot, output);
}

async function generate(options) {
	const output = resolveOutput(options.generator.output?.value);

	await mkdir(dirname(output), { recursive: true });

	options.generator.output = { value: output };
	options.generator.config = {
		disableEmoji: "true",
		includeRelationFromFields: "true",
		...options.generator.config,
	};

	const generateErd = await loadGenerator();
	await generateErd(options);

	return output;
}

if (process.argv.includes("--standalone")) {
	const { Prisma } = await import("@prisma/client");
	const output = await generate({
		dmmf: Prisma.dmmf,
		datamodel: await readFile(
			resolve(packageRoot, "prisma/schema.prisma"),
			"utf8",
		),
		generator: {
			output: { value: defaultOutput },
			config: {
				theme: "neutral",
			},
		},
	});

	console.log(`Prisma ERD exported to ${output}`);
	process.exit(0);
}

const lines = createInterface({ input: process.stdin });

lines.on("line", async (line) => {
	const request = JSON.parse(line);

	if (request.method === "getManifest") {
		respond({
			jsonrpc: "2.0",
			result: {
				manifest: {
					defaultOutput: "../../docs/database-erd.md",
					prettyName: "Taskflow Prisma ERD",
					requiresEngines: [],
					version: "1.0.0",
				},
			},
			id: request.id,
		});
		return;
	}

	if (request.method !== "generate") {
		return;
	}

	try {
		await generate(request.params);
		respond({ jsonrpc: "2.0", result: null, id: request.id });
	} catch (error) {
		respond({
			jsonrpc: "2.0",
			error: {
				code: -32000,
				message: error instanceof Error ? error.message : String(error),
				data: { stack: error instanceof Error ? error.stack : undefined },
			},
			id: request.id,
		});
	}
});
