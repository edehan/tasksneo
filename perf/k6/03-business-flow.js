import http from "k6/http";
import { sleep } from "k6";
import { apiBaseUrl, expectOk, expectStatus, parseStageList, relaxedThresholds } from "./lib/config.js";
import { login } from "./lib/auth.js";
import { pickAccessibleClass, pickTaskForClass, randomUser } from "./lib/data.js";

export const options = {
	stages: parseStageList(__ENV.STAGES, "30s:10,2m:10,30s:25,2m:25,30s:50,2m:50,30s:0"),
	thresholds: relaxedThresholds,
};

function req(method, path, session, endpoint, body = null) {
	const params = { headers: session.headers, tags: { endpoint } };
	if (method === "GET") return http.get(`${apiBaseUrl}${path}`, params);
	if (method === "POST") return http.post(`${apiBaseUrl}${path}`, body ? JSON.stringify(body) : "{}", params);
	if (method === "PUT") return http.put(`${apiBaseUrl}${path}`, body ? JSON.stringify(body) : "{}", params);
	throw new Error(`Unsupported method: ${method}`);
}

export default function () {
	const user = randomUser();
	const session = login(user, { endpoint: "flow_login" });
	const classInfo = pickAccessibleClass(user);
	const task = pickTaskForClass(classInfo.id);

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
