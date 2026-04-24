import http from "k6/http";
import { sleep } from "k6";
import { expectOk, parseStageList, relaxedThresholds, webBaseUrl } from "./lib/config.js";
import { login, ownerUserFromClass } from "./lib/auth.js";
import { pickAccessibleClass, pickOwnerClass, pickTaskForClass, randomUser } from "./lib/data.js";

export const options = {
	stages: parseStageList(__ENV.STAGES, "30s:10,1m:10,30s:0"),
	thresholds: relaxedThresholds,
};

function getPage(path, cookieHeader, endpoint) {
	const response = http.get(`${webBaseUrl}${path}`, {
		headers: { Cookie: cookieHeader },
		tags: { endpoint },
	});
	expectOk(response, endpoint);
	return response;
}

export default function () {
	const mode = __ENV.PAGE || "mixed";
	const user = randomUser();
	const session = login(user, { setup: "login" });
	const classInfo = pickAccessibleClass(user);
	const task = pickTaskForClass(classInfo.id);

	if (mode === "dashboard" || mode === "mixed") {
		getPage("/", session.cookieHeader, "ssr_dashboard");
	}
	if (mode === "class" || mode === "mixed") {
		getPage(`/classes/${classInfo.id}`, session.cookieHeader, "ssr_class");
	}
	if (mode === "task" || mode === "mixed") {
		getPage(`/tasks/${task.id}`, session.cookieHeader, "ssr_task");
	}
	if (mode === "submissions" || mode === "mixed") {
		const ownerClass = pickOwnerClass();
		const ownerSession = login(ownerUserFromClass(ownerClass), { setup: "owner_login" });
		const ownerTask = pickTaskForClass(ownerClass.id);
		getPage(`/tasks/${ownerTask.id}/submissions`, ownerSession.cookieHeader, "ssr_submissions");
	}

	sleep(1);
}
