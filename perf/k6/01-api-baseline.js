import http from "k6/http";
import { sleep } from "k6";
import { apiBaseUrl, expectOk, expectStatus, parseStageList, relaxedThresholds } from "./lib/config.js";
import { login, ownerUserFromClass } from "./lib/auth.js";
import {
	pickAccessibleClass,
	pickOwnerClass,
	pickSubmissionForTask,
	pickTaskForClass,
	randomTask,
	randomUser,
} from "./lib/data.js";

export const options = {
	stages: parseStageList(__ENV.STAGES, "30s:10,1m:10,30s:0"),
	thresholds: relaxedThresholds,
};

const testCase = __ENV.CASE || "classes";

function request(path, session, endpoint, method = "GET", body = null) {
	const params = {
		headers: session.headers,
		tags: { endpoint, case: testCase },
	};
	if (method === "GET") return http.get(`${apiBaseUrl}${path}`, params);
	if (method === "POST") return http.post(`${apiBaseUrl}${path}`, body ? JSON.stringify(body) : "{}", params);
	if (method === "PUT") return http.put(`${apiBaseUrl}${path}`, body ? JSON.stringify(body) : "{}", params);
	throw new Error(`Unsupported method: ${method}`);
}

export default function () {
	const user = randomUser();

	if (testCase === "login") {
		const res = http.post(
			`${apiBaseUrl}/auth/login`,
			JSON.stringify({ email: user.email, password: user.password, trustDevice: false }),
			{
				headers: { "Content-Type": "application/json" },
				tags: { endpoint: "login", case: testCase },
			},
		);
		expectStatus(res, 200, "login");
		sleep(1);
		return;
	}

	const session = login(user, { case: testCase, setup: "login" });
	const classInfo = pickAccessibleClass(user);
	const task = pickTaskForClass(classInfo.id);

	if (testCase === "users_me") {
		expectStatus(request("/users/me", session, "users_me"), 200, "users_me");
	} else if (testCase === "classes") {
		expectStatus(request("/classes", session, "classes"), 200, "classes");
	} else if (testCase === "class_detail") {
		expectOk(request(`/classes/${classInfo.id}`, session, "class_detail"), "class_detail");
	} else if (testCase === "class_tasks") {
		expectStatus(request(`/classes/${classInfo.id}/tasks`, session, "class_tasks"), 200, "class_tasks");
	} else if (testCase === "task_detail") {
		expectOk(request(`/tasks/${task.id}`, session, "task_detail"), "task_detail");
	} else if (testCase === "my_tasks") {
		expectStatus(request("/tasks/mine", session, "my_tasks"), 200, "my_tasks");
	} else if (testCase === "submit_content") {
		expectStatus(
			request(`/tasks/${task.id}/submissions/me`, session, "submit_content", "PUT", {
				content: `k6 baseline submission ${Date.now()} from ${user.email}`,
			}),
			200,
			"submit_content",
		);
	} else if (testCase === "my_submission") {
		const res = request(`/tasks/${task.id}/submissions/me`, session, "my_submission");
		expectOk(res, "my_submission");
	} else if (testCase === "owner_submissions") {
		const ownerClass = pickOwnerClass();
		const ownerSession = login(ownerUserFromClass(ownerClass), { case: testCase, setup: "owner_login" });
		const ownerTask = pickTaskForClass(ownerClass.id);
		expectStatus(
			request(`/tasks/${ownerTask.id}/submissions`, ownerSession, "owner_submissions"),
			200,
			"owner_submissions",
		);
	} else if (testCase === "submission_detail") {
		const submission = pickSubmissionForTask(randomTask().id);
		if (!submission) return;
		expectOk(request(`/submissions/${submission.id}`, session, "submission_detail"), "submission_detail");
	} else {
		throw new Error(`Unknown CASE=${testCase}`);
	}

	sleep(1);
}
