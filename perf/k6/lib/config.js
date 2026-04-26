import { check } from "k6";

export const webBaseUrl = (__ENV.WEB_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
export const apiBaseUrl = (__ENV.API_BASE_URL || "http://127.0.0.1:3001").replace(/\/+$/, "");
export const fixtureFile = __ENV.FIXTURE_FILE || "perf/results/load-fixtures.json";
export const origin = __ENV.ORIGIN || webBaseUrl;
export const defaultPassword = __ENV.SEED_PASSWORD || "12345678";
export const authMode = (__ENV.AUTH_MODE || "per_iter").toLowerCase();
export const cacheMode = (__ENV.CACHE_MODE || "cold").toLowerCase();

export const smokeThresholds = {
	http_req_failed: ["rate<0.01"],
	http_req_duration: ["p(95)<1500", "p(99)<3000"],
	checks: ["rate>0.99"],
};

export const relaxedThresholds = {
	http_req_failed: ["rate<0.02"],
	http_req_duration: ["p(95)<2500", "p(99)<5000"],
	checks: ["rate>0.98"],
};

export function parseStageList(value, fallback) {
	const raw = value || fallback;
	return raw.split(",").map((part) => {
		const [duration, targetRaw] = part.trim().split(":");
		const target = Number(targetRaw);
		if (!duration || !Number.isFinite(target)) {
			throw new Error(`Invalid STAGES item: ${part}`);
		}
		return { duration, target };
	});
}

export function expectStatus(response, status, name) {
	return check(response, {
		[`${name} status ${status}`]: (r) => r.status === status,
	});
}

export function expectOk(response, name) {
	return check(response, {
		[`${name} status 2xx/3xx`]: (r) => r.status >= 200 && r.status < 400,
	});
}
