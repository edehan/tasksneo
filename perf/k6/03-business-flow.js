import http from "k6/http";
import { sleep } from "k6";
import { apiBaseUrl, cacheMode, expectOk, expectStatus, parseStageList, relaxedThresholds } from "./lib/config.js";
import { sessionForUser } from "./lib/auth.js";
import { pickScenarioClass, pickScenarioTaskForClass, scenarioUser } from "./lib/data.js";

export const options = {
	stages: parseStageList(__ENV.STAGES, "30s:10,2m:10,30s:25,2m:25,30s:50,2m:50,30s:0"),
	thresholds: relaxedThresholds,
};

const warmedKeys = new Set();

function req(method, path, session, endpoint, body = null, phase = "measure") {
	const params = {
		headers: session.headers,
		tags: { endpoint: phase === "warmup" ? `${endpoint}_warmup` : endpoint, phase },
	};
	if (method === "GET") return http.get(`${apiBaseUrl}${path}`, params);
	if (method === "POST") return http.post(`${apiBaseUrl}${path}`, body ? JSON.stringify(body) : "{}", params);
	if (method === "PUT") return http.put(`${apiBaseUrl}${path}`, body ? JSON.stringify(body) : "{}", params);
	throw new Error(`Unsupported method: ${method}`);
}

function warmGetOnce(key, path, session, endpoint) {
	if (cacheMode !== "warm" || __ITER !== 0 || warmedKeys.has(key)) return;
	warmedKeys.add(key);
	req("GET", path, session, endpoint, null, "warmup");
}

export default function () {
	const user = scenarioUser();
	const session = sessionForUser(user, { endpoint: "flow_login" });
	const classInfo = pickScenarioClass(user);
	const task = pickScenarioTaskForClass(classInfo.id);

	warmGetOnce("flow_classes", "/classes", session, "flow_classes");
	warmGetOnce("flow_class_detail", `/classes/${classInfo.id}`, session, "flow_class_detail");
	warmGetOnce("flow_class_tasks", `/classes/${classInfo.id}/tasks`, session, "flow_class_tasks");
	warmGetOnce("flow_task_detail", `/tasks/${task.id}`, session, "flow_task_detail");
	warmGetOnce("flow_my_submission", `/tasks/${task.id}/submissions/me`, session, "flow_my_submission");

	expectStatus(req("GET", "/classes", session, "flow_classes"), 200, "flow_classes");
	expectOk(req("GET", `/classes/${classInfo.id}`, session, "flow_class_detail"), "flow_class_detail");
	expectStatus(req("GET", `/classes/${classInfo.id}/tasks`, session, "flow_class_tasks"), 200, "flow_class_tasks");
	expectOk(req("GET", `/tasks/${task.id}`, session, "flow_task_detail"), "flow_task_detail");
	expectStatus(req("POST", `/tasks/${task.id}/view`, session, "flow_task_view"), 204, "flow_task_view");
	expectStatus(
		req("PUT", `/tasks/${task.id}/submissions/me`, session, "flow_submit", {
			content: `Business-flow answer from ${user.email} at ${new Date().toISOString()}`,
		}),
		200,
		"flow_submit",
	);
	expectOk(req("GET", `/tasks/${task.id}/submissions/me`, session, "flow_my_submission"), "flow_my_submission");

	sleep(1);
}
