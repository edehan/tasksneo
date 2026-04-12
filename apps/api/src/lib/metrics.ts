const BUFFER_SIZE = 500;
const startTime = Date.now();

interface RouteStats {
	count: number;
	errors: number;
	samples: number[];
	sampleIdx: number;
}

const routes = new Map<string, RouteStats>();
const statusCounts = new Map<string, number>();
let requestsTotal = 0;

function statusBucket(status: number): string {
	if (status < 200) return "1xx";
	if (status < 300) return "2xx";
	if (status < 400) return "3xx";
	if (status < 500) return "4xx";
	return "5xx";
}

export function recordRequest(params: {
	route: string;
	status: number;
	duration_ms: number;
}): void {
	requestsTotal += 1;

	const bucket = statusBucket(params.status);
	statusCounts.set(bucket, (statusCounts.get(bucket) ?? 0) + 1);
	const exact = String(params.status);
	statusCounts.set(exact, (statusCounts.get(exact) ?? 0) + 1);

	let s = routes.get(params.route);
	if (!s) {
		s = { count: 0, errors: 0, samples: [], sampleIdx: 0 };
		routes.set(params.route, s);
	}
	s.count += 1;
	if (params.status >= 500) s.errors += 1;

	if (s.samples.length < BUFFER_SIZE) {
		s.samples.push(params.duration_ms);
	} else {
		s.samples[s.sampleIdx] = params.duration_ms;
		s.sampleIdx = (s.sampleIdx + 1) % BUFFER_SIZE;
	}
}

function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0;
	const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
	return sorted[idx] ?? 0;
}

export interface RouteSnapshot {
	route: string;
	count: number;
	errors: number;
	p50_ms: number;
	p95_ms: number;
	p99_ms: number;
}

export interface MetricsSnapshot {
	uptime_s: number;
	requests_total: number;
	requests_by_status: Record<string, number>;
	routes: RouteSnapshot[];
}

export function getMetricsSnapshot(): MetricsSnapshot {
	const uptime_s = Math.floor((Date.now() - startTime) / 1000);
	const requests_by_status: Record<string, number> = {};
	for (const [k, v] of statusCounts) requests_by_status[k] = v;

	const routesOut: RouteSnapshot[] = Array.from(routes.entries()).map(
		([route, s]) => {
			const sorted = [...s.samples].sort((a, b) => a - b);
			return {
				route,
				count: s.count,
				errors: s.errors,
				p50_ms: percentile(sorted, 0.5),
				p95_ms: percentile(sorted, 0.95),
				p99_ms: percentile(sorted, 0.99),
			};
		},
	);
	routesOut.sort((a, b) => b.count - a.count);

	return {
		uptime_s,
		requests_total: requestsTotal,
		requests_by_status,
		routes: routesOut,
	};
}
