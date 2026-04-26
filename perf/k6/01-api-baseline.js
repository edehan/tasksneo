import http from "k6/http";
import { sleep } from "k6";
import { apiBaseUrl, cacheMode, expectOk, expectStatus, parseStageList, relaxedThresholds } from "./lib/config.js";
import { ownerUserFromClass, sessionForUser } from "./lib/auth.js";
import {
	pickScenarioClass,
	pickScenarioOwnerClass,
	pickScenarioTaskForClass,
	pickSubmissionForTask,
	randomTask,
	scenarioUser,
} from "./lib/data.js";

export const options = {
	stages: parseStageList(__ENV.STAGES, "30s:10,1m:10,30s:0"),
	thresholds: relaxedThresholds,
};

const testCase = __ENV.CASE || "classes";
const warmedKeys = new Set();

function request(path, session, endpoint, method = "GET", body = null, phase = "measure") {
	const params = {
		headers: session.headers,
		tags: {
			endpoint: phase === "warmup" ? `${endpoint}_warmup` : endpoint,
			case: testCase,
			phase,
		},
	};
	if (method === "GET") return http.get(`${apiBaseUrl}${path}`, params);
	if (method === "POST") return http.post(`${apiBaseUrl}${path}`, body ? JSON.stringify(body) : "{}", params);
	if (method === "PUT") return http.put(`${apiBaseUrl}${path}`, body ? JSON.stringify(body) : "{}", params);
	throw new Error(`Unsupported method: ${method}`);
}

function warmOnce(key, fn) {
	if (cacheMode !== "warm" || __ITER !== 0 || warmedKeys.has(key)) return;
	warmedKeys.add(key);
	fn();
}

export default function () {
	const user = scenarioUser();

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

	const session = sessionForUser(user, { case: testCase, setup: "login" });
	const classInfo = pickScenarioClass(user);
	const task = pickScenarioTaskForClass(classInfo.id);

	if (testCase === "users_me") {
		warmOnce("users_me", () => request("/users/me", session, "users_me", "GET", null, "warmup"));
		expectStatus(request("/users/me", session, "users_me"), 200, "users_me");
	} else if (testCase === "classes") {
		warmOnce("classes", () => request("/classes", session, "classes", "GET", null, "warmup"));
		expectStatus(request("/classes", session, "classes"), 200, "classes");
	} else if (testCase === "class_detail") {
		warmOnce("class_detail", () =>
			request(`/classes/${classInfo.id}`, session, "class_detail", "GET", null, "warmup"),
		);
		expectOk(request(`/classes/${classInfo.id}`, session, "class_detail"), "class_detail");
	} else if (testCase === "class_tasks") {
		warmOnce("class_tasks", () =>
			request(`/classes/${classInfo.id}/tasks`, session, "class_tasks", "GET", null, "warmup"),
		);
		expectStatus(request(`/classes/${classInfo.id}/tasks`, session, "class_tasks"), 200, "class_tasks");
	} else if (testCase === "task_detail") {
		warmOnce("task_detail", () => request(`/tasks/${task.id}`, session, "task_detail", "GET", null, "warmup"));
		expectOk(request(`/tasks/${task.id}`, session, "task_detail"), "task_detail");
	} else if (testCase === "my_tasks") {
		warmOnce("my_tasks", () => request("/tasks/mine", session, "my_tasks", "GET", null, "warmup"));
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
		warmOnce("my_submission", () =>
			request(`/tasks/${task.id}/submissions/me`, session, "my_submission", "GET", null, "warmup"),
		);
		const res = request(`/tasks/${task.id}/submissions/me`, session, "my_submission");
		expectOk(res, "my_submission");
	} else if (testCase === "owner_submissions") {
		const ownerClass = pickScenarioOwnerClass();
		const ownerSession = sessionForUser(ownerUserFromClass(ownerClass), { case: testCase, setup: "owner_login" });
		const ownerTask = pickScenarioTaskForClass(ownerClass.id);
		warmOnce("owner_submissions", () =>
			request(`/tasks/${ownerTask.id}/submissions`, ownerSession, "owner_submissions", "GET", null, "warmup"),
		);
		expectStatus(
			request(`/tasks/${ownerTask.id}/submissions`, ownerSession, "owner_submissions"),
			200,
			"owner_submissions",
		);
	} else if (testCase === "submission_detail") {
		const submission = pickSubmissionForTask(randomTask().id);
		if (!submission) return;
		warmOnce("submission_detail", () =>
			request(`/submissions/${submission.id}`, session, "submission_detail", "GET", null, "warmup"),
		);
		expectOk(request(`/submissions/${submission.id}`, session, "submission_detail"), "submission_detail");
	} else {
		throw new Error(`Unknown CASE=${testCase}`);
	}

	sleep(1);
}
