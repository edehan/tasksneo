import http from "k6/http";
import { sleep } from "k6";
import { cacheMode, expectOk, parseStageList, relaxedThresholds, webBaseUrl } from "./lib/config.js";
import { ownerUserFromClass, sessionForUser } from "./lib/auth.js";
import { pickScenarioClass, pickScenarioOwnerClass, pickScenarioTaskForClass, scenarioUser } from "./lib/data.js";

export const options = {
	stages: parseStageList(__ENV.STAGES, "30s:10,1m:10,30s:0"),
	thresholds: relaxedThresholds,
};

const warmedKeys = new Set();

function getPage(path, cookieHeader, endpoint, phase = "measure") {
	const response = http.get(`${webBaseUrl}${path}`, {
		headers: { Cookie: cookieHeader },
		tags: {
			endpoint: phase === "warmup" ? `${endpoint}_warmup` : endpoint,
			phase,
		},
	});
	expectOk(response, endpoint);
	return response;
}

function warmPageOnce(key, path, cookieHeader, endpoint) {
	if (cacheMode !== "warm" || __ITER !== 0 || warmedKeys.has(key)) return;
	warmedKeys.add(key);
	getPage(path, cookieHeader, endpoint, "warmup");
}

export default function () {
	const mode = __ENV.PAGE || "mixed";
	const user = scenarioUser();
	const session = sessionForUser(user, { setup: "login" });
	const classInfo = pickScenarioClass(user);
	const task = pickScenarioTaskForClass(classInfo.id);

	if (mode === "dashboard" || mode === "mixed") {
		warmPageOnce("ssr_dashboard", "/", session.cookieHeader, "ssr_dashboard");
		getPage("/", session.cookieHeader, "ssr_dashboard");
	}
	if (mode === "class" || mode === "mixed") {
		warmPageOnce("ssr_class", `/classes/${classInfo.id}`, session.cookieHeader, "ssr_class");
		getPage(`/classes/${classInfo.id}`, session.cookieHeader, "ssr_class");
	}
	if (mode === "task" || mode === "mixed") {
		warmPageOnce("ssr_task", `/tasks/${task.id}`, session.cookieHeader, "ssr_task");
		getPage(`/tasks/${task.id}`, session.cookieHeader, "ssr_task");
	}
	if (mode === "submissions" || mode === "mixed") {
		const ownerClass = pickScenarioOwnerClass();
		const ownerSession = sessionForUser(ownerUserFromClass(ownerClass), { setup: "owner_login" });
		const ownerTask = pickScenarioTaskForClass(ownerClass.id);
		warmPageOnce(
			"ssr_submissions",
			`/tasks/${ownerTask.id}/submissions`,
			ownerSession.cookieHeader,
			"ssr_submissions",
		);
		getPage(`/tasks/${ownerTask.id}/submissions`, ownerSession.cookieHeader, "ssr_submissions");
	}

	sleep(1);
}
