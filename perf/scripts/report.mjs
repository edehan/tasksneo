import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const runDir = process.argv[2];
if (!runDir) {
	console.error("Usage: node perf/scripts/report.mjs <perf/results/run-id>");
	process.exit(1);
}

function metric(summary, name) {
	return summary.metrics?.[name] ?? {};
}

function value(summary, name, key) {
	const item = metric(summary, name);
	return item?.[key] ?? item?.values?.[key] ?? "";
}

function csvEscape(value) {
	const text = String(value ?? "");
	return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function readJsonIfExists(path) {
	try {
		return JSON.parse(await readFile(path, "utf8"));
	} catch {
		return null;
	}
}

async function listSummaryFiles() {
	const files = await readdir(runDir);
	return files.filter((file) => file.endsWith("-summary.json")).sort();
}

function scenarioName(file) {
	return file.replace(/-summary\.json$/, "");
}

async function buildSummaryTables(files) {
	const rows = [];
	for (const file of files) {
		const summary = await readJsonIfExists(join(runDir, file));
		if (!summary) continue;
		rows.push({
			scenario: scenarioName(file),
			requests: value(summary, "http_reqs", "count"),
			rate: value(summary, "http_reqs", "rate"),
			avg_ms: value(summary, "http_req_duration", "avg"),
			p90_ms: value(summary, "http_req_duration", "p(90)"),
			p95_ms: value(summary, "http_req_duration", "p(95)"),
			p99_ms: value(summary, "http_req_duration", "p(99)"),
			failed_rate: value(summary, "http_req_failed", "rate"),
			check_rate: value(summary, "checks", "rate"),
		});
	}
	return rows;
}

async function writeCsv(path, rows) {
	if (rows.length === 0) {
		await writeFile(path, "", "utf8");
		return;
	}
	const headers = Object.keys(rows[0]);
	const lines = [
		headers.join(","),
		...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(",")),
	];
	await writeFile(path, `${lines.join("\n")}\n`, "utf8");
}

function mdTable(rows) {
	if (rows.length === 0) return "_No data._";
	const headers = Object.keys(rows[0]);
	const head = `| ${headers.join(" | ")} |`;
	const sep = `| ${headers.map(() => "---").join(" | ")} |`;
	const body = rows.map((row) => `| ${headers.map((h) => csvEscape(row[h])).join(" | ")} |`);
	return [head, sep, ...body].join("\n");
}

function parsePercent(value) {
	const n = Number(String(value).replace("%", "").trim());
	return Number.isFinite(n) ? n : 0;
}

async function readDockerStats() {
	const path = join(runDir, "docker-stats.csv");
	try {
		const lines = (await readFile(path, "utf8")).trim().split("\n").slice(1);
		return lines.map((line) => {
			const [timestamp, name, cpu, memUsage, memLimit, memPercent] = line.split(",");
			return {
				timestamp,
				name,
				cpu: parsePercent(cpu),
				memUsage,
				memLimit,
				memPercent: parsePercent(memPercent),
			};
		});
	} catch {
		return [];
	}
}

function simpleSvg(title, points, yKey) {
	const width = 900;
	const height = 320;
	const pad = 44;
	const maxY = Math.max(1, ...points.map((p) => p[yKey]));
	const step = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 1;
	const coords = points
		.map((p, i) => {
			const x = pad + i * step;
			const y = height - pad - (p[yKey] / maxY) * (height - pad * 2);
			return `${x.toFixed(1)},${y.toFixed(1)}`;
		})
		.join(" ");
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="white"/>
  <text x="${pad}" y="24" font-family="sans-serif" font-size="18">${title}</text>
  <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="#888"/>
  <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" stroke="#888"/>
  <polyline fill="none" stroke="#2563eb" stroke-width="2" points="${coords}"/>
  <text x="${pad}" y="${height - 12}" font-family="sans-serif" font-size="12">samples</text>
  <text x="${pad}" y="${pad - 8}" font-family="sans-serif" font-size="12">max ${maxY.toFixed(2)}</text>
</svg>
`;
}

async function writeCharts(stats) {
	const chartDir = join(runDir, "charts");
	await mkdir(chartDir, { recursive: true });
	const grouped = new Map();
	for (const row of stats) {
		if (!grouped.has(row.name)) grouped.set(row.name, []);
		grouped.get(row.name).push(row);
	}
	for (const [name, rows] of grouped) {
		await writeFile(join(chartDir, `${name}-cpu.svg`), simpleSvg(`${name} CPU %`, rows, "cpu"), "utf8");
		await writeFile(join(chartDir, `${name}-mem.svg`), simpleSvg(`${name} memory %`, rows, "memPercent"), "utf8");
	}
}

async function main() {
	const tableDir = join(runDir, "tables");
	await mkdir(tableDir, { recursive: true });

	const summaryFiles = await listSummaryFiles();
	const rows = await buildSummaryTables(summaryFiles);
	await writeCsv(join(tableDir, "k6-summary.csv"), rows);

	const apiRows = rows.filter((row) => row.scenario.startsWith("api-"));
	const ssrRows = rows.filter((row) => row.scenario.startsWith("ssr"));
	const flowRows = rows.filter((row) => row.scenario.includes("business") || row.scenario.includes("soak") || row.scenario.includes("stress"));
	await writeCsv(join(tableDir, "api-baseline.csv"), apiRows);
	await writeCsv(join(tableDir, "ssr-pages.csv"), ssrRows);
	await writeCsv(join(tableDir, "flows.csv"), flowRows);

	const dockerStats = await readDockerStats();
	if (dockerStats.length > 0) {
		await writeCharts(dockerStats);
	}

	const report = [
		"# Performance Report",
		"",
		`Run directory: \`${runDir}\``,
		"",
		"## k6 Summary",
		"",
		mdTable(rows),
		"",
		"## Generated Files",
		"",
		"- `tables/k6-summary.csv`",
		"- `tables/api-baseline.csv`",
		"- `tables/ssr-pages.csv`",
		"- `tables/flows.csv`",
		dockerStats.length > 0 ? "- `charts/*.svg`" : "- Docker stats were not found; no resource charts generated.",
		"",
	].join("\n");

	await writeFile(join(runDir, "report.md"), report, "utf8");
	console.log(`wrote ${join(runDir, "report.md")}`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
