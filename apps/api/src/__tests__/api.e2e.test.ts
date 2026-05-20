import {
	AuthProvider,
	ClassRole,
	EmailTokenPurpose,
	prisma,
} from "@taskflow/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import {
	decryptConfigValue,
	encryptConfigValue,
} from "../lib/system-config.js";
import {
	createTestUser,
	json,
	requestJson,
	resetDatabase,
	uniqueEmail,
} from "./test-helpers.js";

const app = createApp({ startWorker: false });

function authHeader(token: string) {
	return { Authorization: `Bearer ${token}` };
}

interface DirectUploadTarget {
	fileKey: string;
	uploadUrl: string;
	expiresIn: number;
	headers: Record<string, string>;
}

async function uploadAttachmentDirect(input: {
	uploadUrlPath: string;
	completePath: string;
	token: string;
	fileName: string;
	content: string;
	mimeType: string;
	isVisible?: boolean;
}) {
	const bytes = Buffer.from(input.content);
	const uploadUrlRes = await requestJson(app, input.uploadUrlPath, {
		method: "POST",
		headers: authHeader(input.token),
		body: JSON.stringify({
			files: [
				{
					name: input.fileName,
					mimeType: input.mimeType,
					sizeBytes: bytes.byteLength,
				},
			],
		}),
	});
	expect(uploadUrlRes.response.status).toBe(200);
	const [upload] = uploadUrlRes.body as DirectUploadTarget[];
	expect(upload?.fileKey).toBeTruthy();
	expect(upload?.expiresIn).toBe(300);
	if (!upload) {
		throw new Error("Upload URL response was empty");
	}

	const putRes = await fetch(upload.uploadUrl, {
		method: "PUT",
		headers: upload.headers,
		body: bytes,
	});
	expect(putRes.ok).toBe(true);

	const completeRes = await requestJson(app, input.completePath, {
		method: "POST",
		headers: authHeader(input.token),
		body: JSON.stringify({
			attachments: [
				{
					fileKey: upload.fileKey,
					originalName: input.fileName,
					mimeType: input.mimeType,
					sizeBytes: bytes.byteLength,
				},
			],
			...(input.isVisible !== undefined ? { isVisible: input.isVisible } : {}),
		}),
	});
	expect(completeRes.response.status).toBe(201);

	return completeRes.body;
}

function readSessionTokenFromSetCookie(res: Response): string {
	const raw = res.headers.get("set-cookie") ?? "";
	const match = raw.match(/tfses_session=([^;]+)/);
	if (!match) {
		throw new Error("Missing tfses_session Set-Cookie header");
	}
	return decodeURIComponent(match[1]);
}

describe("TaskFlow API e2e", () => {
	beforeAll(async () => {
		await resetDatabase();
	});

	beforeEach(async () => {
		await resetDatabase();
	});

	afterAll(async () => {
		await prisma.$disconnect();
	});

	it("returns 401 for protected endpoints without token", async () => {
		const protectedEndpoints: Array<{ method: string; path: string }> = [
			{ method: "GET", path: "/users/me" },
			{ method: "GET", path: "/classes" },
			{ method: "POST", path: "/classes/join" },
			{ method: "GET", path: "/tasks/00000000-0000-0000-0000-000000000000" },
			{ method: "GET", path: "/files/any" },
		];

		for (const endpoint of protectedEndpoints) {
			const response = await app.request(endpoint.path, {
				method: endpoint.method,
			});
			expect(response.status).toBe(401);
		}
	});

	it("accepts cookie auth without Authorization header", async () => {
		const { token } = await createTestUser({ emailPrefix: "cookie-auth" });

		const response = await app.request("/users/me", {
			headers: { Cookie: `tfses_session=${token}` },
		});

		expect(response.status).toBe(200);
	});

	it("returns CORS headers for allowed frontend origins", async () => {
		const response = await app.request("/health", {
			method: "OPTIONS",
			headers: {
				Origin: "http://localhost:35540",
				"Access-Control-Request-Method": "GET",
				"Access-Control-Request-Headers": "Authorization, Content-Type",
			},
		});

		expect(response.status).toBe(204);
		expect(response.headers.get("access-control-allow-origin")).toBe(
			"http://localhost:35540",
		);
		expect(response.headers.get("access-control-allow-credentials")).toBe(
			"true",
		);
		expect(response.headers.get("access-control-allow-headers")).toContain(
			"Authorization",
		);
	});

	it("rejects cookie-authenticated write requests from disallowed origins", async () => {
		const { token } = await createTestUser({ emailPrefix: "csrf-origin" });
		const response = await app.request("/users/me/notification-prefs", {
			method: "POST",
			headers: {
				Origin: "https://evil.example",
				Cookie: `tfses_session=${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				channel: "EMAIL",
				address: "csrf-origin@example.com",
				isEnabled: true,
			}),
		});

		expect(response.status).toBe(403);
		const body = (await json(response)) as { code?: string };
		expect(body.code).toBe("FORBIDDEN");
	});

	it("returns placeholder text for undecryptable secret config values", async () => {
		const adminToken = process.env.ADMIN_TOKEN ?? "test-admin-token";

		await prisma.systemConfig.create({
			data: {
				key: "smtp.password",
				value: "enc:v1:AAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAA==:AAAAAAAA",
			},
		});

		const response = await app.request("/admin/config", {
			headers: { Authorization: `Bearer ${adminToken}` },
		});

		expect(response.status).toBe(200);
		const body = (await json(response)) as Record<string, string>;
		expect(body["smtp.password"]).toBe("[re-enter value]");
	});

	it("records successful auth audit logs without recording failed login attempts", async () => {
		const adminToken = process.env.ADMIN_TOKEN ?? "test-admin-token";
		const { user } = await createTestUser({
			emailPrefix: "audit-auth",
			password: "Passw0rd!",
		});

		const failed = await requestJson(app, "/auth/login", {
			method: "POST",
			body: JSON.stringify({
				email: user.email,
				password: "wrong-password",
			}),
		});
		expect(failed.response.status).toBe(401);

		const login = await requestJson(app, "/auth/login", {
			method: "POST",
			headers: { "user-agent": "audit-test" },
			body: JSON.stringify({
				email: user.email,
				password: "Passw0rd!",
				trustDevice: true,
			}),
		});
		expect(login.response.status).toBe(200);

		const logs = await requestJson(app, "/admin/audit-logs?action=AUTH_LOGIN", {
			headers: { Authorization: `Bearer ${adminToken}` },
		});
		expect(logs.response.status).toBe(200);
		const body = logs.body as {
			items: Array<{ action: string; actorUserId: string | null }>;
		};
		expect(body.items).toHaveLength(1);
		expect(body.items[0]).toMatchObject({
			action: "AUTH_LOGIN",
			actorUserId: user.id,
		});

		const verify = await requestJson(app, "/admin/audit-logs/verify", {
			method: "POST",
			headers: { Authorization: `Bearer ${adminToken}` },
			body: JSON.stringify({}),
		});
		expect(verify.response.status).toBe(200);
		expect(verify.body).toMatchObject({
			valid: true,
			checkedCount: 1,
			failure: null,
		});
	});

	it("records class membership and ownership audit logs once per high-level action", async () => {
		const adminToken = process.env.ADMIN_TOKEN ?? "test-admin-token";
		const owner = await createTestUser({ emailPrefix: "audit-owner" });
		const member = await createTestUser({ emailPrefix: "audit-member" });
		const extra = await createTestUser({ emailPrefix: "audit-extra" });

		async function createSharedClass(name: string) {
			const res = await requestJson(app, "/classes", {
				method: "POST",
				headers: authHeader(owner.token),
				body: JSON.stringify({ name }),
			});
			expect(res.response.status).toBe(201);
			return res.body as { id: string; inviteCode: string };
		}

		const joinedAndLeft = await createSharedClass("Audit Join Leave");
		const joinRes = await requestJson(app, "/classes/join", {
			method: "POST",
			headers: authHeader(member.token),
			body: JSON.stringify({ inviteCode: joinedAndLeft.inviteCode }),
		});
		expect(joinRes.response.status).toBe(200);
		const leaveRes = await app.request(
			`/classes/${joinedAndLeft.id}/members/${member.user.id}`,
			{
				method: "DELETE",
				headers: authHeader(member.token),
			},
		);
		expect(leaveRes.status).toBe(204);

		const removed = await createSharedClass("Audit Remove");
		await requestJson(app, "/classes/join", {
			method: "POST",
			headers: authHeader(member.token),
			body: JSON.stringify({ inviteCode: removed.inviteCode }),
		});
		const removeRes = await app.request(
			`/classes/${removed.id}/members/${member.user.id}`,
			{
				method: "DELETE",
				headers: authHeader(owner.token),
			},
		);
		expect(removeRes.status).toBe(204);

		const transferred = await createSharedClass("Audit Transfer Delete");
		await requestJson(app, "/classes/join", {
			method: "POST",
			headers: authHeader(member.token),
			body: JSON.stringify({ inviteCode: transferred.inviteCode }),
		});
		await requestJson(app, "/classes/join", {
			method: "POST",
			headers: authHeader(extra.token),
			body: JSON.stringify({ inviteCode: transferred.inviteCode }),
		});
		const roleRes = await requestJson(
			app,
			`/classes/${transferred.id}/members/${extra.user.id}`,
			{
				method: "PATCH",
				headers: authHeader(owner.token),
				body: JSON.stringify({ role: "ADMIN" }),
			},
		);
		expect(roleRes.response.status).toBe(200);
		const transferRes = await requestJson(
			app,
			`/classes/${transferred.id}/transfer`,
			{
				method: "POST",
				headers: authHeader(owner.token),
				body: JSON.stringify({ newOwnerId: member.user.id }),
			},
		);
		expect(transferRes.response.status).toBe(200);
		const deleteRes = await app.request(`/classes/${transferred.id}`, {
			method: "DELETE",
			headers: authHeader(member.token),
		});
		expect(deleteRes.status).toBe(204);

		const logs = await requestJson(app, "/admin/audit-logs?targetType=CLASS", {
			headers: { Authorization: `Bearer ${adminToken}` },
		});
		expect(logs.response.status).toBe(200);
		const actions = (
			logs.body as { items: Array<{ action: string }> }
		).items.map((item) => item.action);
		expect(actions).toContain("CLASS_OWNERSHIP_TRANSFERRED");
		expect(actions).toContain("CLASS_DELETED");

		const allLogs = await requestJson(app, "/admin/audit-logs", {
			headers: { Authorization: `Bearer ${adminToken}` },
		});
		const allActions = (
			allLogs.body as { items: Array<{ action: string }> }
		).items.map((item) => item.action);
		expect(allActions.filter((a) => a === "CLASS_MEMBER_JOINED")).toHaveLength(
			4,
		);
		expect(allActions).toContain("CLASS_MEMBER_LEFT");
		expect(allActions).toContain("CLASS_MEMBER_REMOVED");
		expect(allActions).toContain("CLASS_MEMBER_ROLE_UPDATED");
	});

	it("round-trips encrypted system config values", () => {
		const encrypted = encryptConfigValue("preview-pass-123");

		expect(decryptConfigValue(encrypted)).toBe("preview-pass-123");
	});

	it("rejects delayed announcements when notification worker is disabled", async () => {
		const adminToken = process.env.ADMIN_TOKEN ?? "test-admin-token";
		const res = await requestJson(app, "/admin/announcements", {
			method: "POST",
			headers: { Authorization: `Bearer ${adminToken}` },
			body: JSON.stringify({
				title: "Maintenance",
				content: "Scheduled update",
				publishMode: "delayed",
			}),
		});

		expect(res.response.status).toBe(503);
		expect((res.body as { code?: string })?.code).toBe(
			"NOTIFICATION_WORKER_DISABLED",
		);
	});

	it("processes immediate announcements inline when notification worker is disabled", async () => {
		const adminToken = process.env.ADMIN_TOKEN ?? "test-admin-token";
		const user = await prisma.user.create({
			data: {
				email: uniqueEmail("announcement-inline"),
				nickname: "Announcement Inline",
			},
		});

		const res = await requestJson(app, "/admin/announcements", {
			method: "POST",
			headers: { Authorization: `Bearer ${adminToken}` },
			body: JSON.stringify({
				title: "Immediate notice",
				content: "Please read",
				publishMode: "immediate",
			}),
		});

		expect(res.response.status).toBe(201);

		const jobs = await prisma.notificationJob.findMany({
			where: { userId: user.id },
			orderBy: { createdAt: "desc" },
			take: 5,
		});

		expect(jobs.length).toBeGreaterThan(0);
		expect(jobs[0]?.status).toBe("FAILED");
	});

	it("covers all implemented endpoints success and key failures", async () => {
		const adminToken = process.env.ADMIN_TOKEN ?? "test-admin-token";

		const configPatch = await requestJson(app, "/admin/config", {
			method: "PATCH",
			headers: { Authorization: `Bearer ${adminToken}` },
			body: JSON.stringify({
				"app.title": "TaskFlow Test",
				"auth.registration_open": "true",
			}),
		});

		expect(configPatch.response.status).toBe(200);

		const configGet = await app.request("/admin/config", {
			headers: { Authorization: `Bearer ${adminToken}` },
		});
		expect(configGet.status).toBe(200);

		const sendTestEmailWithoutSmtp = await requestJson(
			app,
			"/admin/config/test-email",
			{
				method: "POST",
				headers: { Authorization: `Bearer ${adminToken}` },
				body: JSON.stringify({ to: "smtp-test@example.com" }),
			},
		);
		expect(sendTestEmailWithoutSmtp.response.status).toBe(400);
		expect((sendTestEmailWithoutSmtp.body as { code: string }).code).toBe(
			"SMTP_NOT_CONFIGURED",
		);

		const schoolARes = await requestJson(app, "/admin/schools", {
			method: "POST",
			headers: { Authorization: `Bearer ${adminToken}` },
			body: JSON.stringify({ name: `SchoolA-${Date.now()}` }),
		});
		expect(schoolARes.response.status).toBe(201);

		const schoolBRes = await requestJson(app, "/admin/schools", {
			method: "POST",
			headers: { Authorization: `Bearer ${adminToken}` },
			body: JSON.stringify({ name: `SchoolB-${Date.now()}` }),
		});
		expect(schoolBRes.response.status).toBe(201);

		const schoolAId = (schoolARes.body as { id: string }).id;
		const schoolBId = (schoolBRes.body as { id: string }).id;

		const publicSchools = await app.request("/schools");
		expect(publicSchools.status).toBe(200);

		const ownerEmail = uniqueEmail("owner");
		const memberEmail = uniqueEmail("member");
		const outsiderEmail = uniqueEmail("outsider");
		const tempEmail = uniqueEmail("temp");

		// Create users directly via the service — bypasses the two-step email
		// verification flow that /auth/register expects. Helper returns the same
		// `{ token, user }` shape as a successful registration.
		const ownerRegisterBody = await createTestUser({
			email: ownerEmail,
			password: "Passw0rd!",
			nickname: "Owner",
			schoolId: schoolAId,
			studentId: "1001",
			timezone: "Asia/Shanghai",
		});
		expect(ownerRegisterBody.user.timezone).toBe("Asia/Shanghai");

		const ownerToken = ownerRegisterBody.token;
		const ownerUserId = ownerRegisterBody.user.id;

		const registerMember = await createTestUser({
			email: memberEmail,
			password: "Passw0rd!",
			nickname: "Member",
			schoolId: schoolAId,
			studentId: "1002",
		});

		const memberToken = registerMember.token;
		const memberUserId = registerMember.user.id;

		const registerOutsider = await createTestUser({
			email: outsiderEmail,
			password: "Passw0rd!",
			nickname: "Outsider",
			schoolId: schoolBId,
			studentId: "2001",
		});

		const outsiderToken = registerOutsider.token;
		const outsiderUserId = registerOutsider.user.id;

		const registerTemp = await createTestUser({
			email: tempEmail,
			password: "Passw0rd!",
		});
		expect(registerTemp.user.timezone).toBe("UTC");

		const tempToken = registerTemp.token;

		const loginOwner = await requestJson(app, "/auth/login", {
			method: "POST",
			body: JSON.stringify({ email: ownerEmail, password: "Passw0rd!" }),
		});
		expect(loginOwner.response.status).toBe(200);

		const meOwner = await app.request("/users/me", {
			headers: authHeader(ownerToken),
		});
		expect(meOwner.status).toBe(200);

		const patchInvalidStudentId = await requestJson(app, "/users/me", {
			method: "PATCH",
			headers: authHeader(ownerToken),
			body: JSON.stringify({
				nickname: "Owner Updated",
				schoolId: schoolAId,
				studentId: "A099",
				timezone: "America/New_York",
			}),
		});
		expect(patchInvalidStudentId.response.status).toBe(400);

		const patchMe = await requestJson(app, "/users/me", {
			method: "PATCH",
			headers: authHeader(ownerToken),
			body: JSON.stringify({
				nickname: "Owner Updated",
				schoolId: schoolAId,
				studentId: "1099",
				timezone: "America/New_York",
			}),
		});
		expect(patchMe.response.status).toBe(200);
		expect((patchMe.body as { timezone: string }).timezone).toBe(
			"America/New_York",
		);

		const patchPassword = await requestJson(app, "/users/me/password", {
			method: "PATCH",
			headers: authHeader(ownerToken),
			body: JSON.stringify({
				currentPassword: "Passw0rd!",
				newPassword: "Passw0rd!2",
			}),
		});
		expect(patchPassword.response.status).toBe(204);

		const prefsGet = await app.request("/users/me/notification-prefs", {
			headers: authHeader(ownerToken),
		});
		expect(prefsGet.status).toBe(200);

		const prefsPost = await requestJson(app, "/users/me/notification-prefs", {
			method: "POST",
			headers: authHeader(ownerToken),
			body: JSON.stringify({
				channel: "EMAIL",
				address: ownerEmail,
				isEnabled: true,
			}),
		});
		expect(prefsPost.response.status).toBe(200);

		const avatarResponse = await app.request("/users/me/avatar", {
			method: "POST",
			headers: authHeader(ownerToken),
		});
		expect(avatarResponse.status).toBe(404);

		const createClassRes = await requestJson(app, "/classes", {
			method: "POST",
			headers: authHeader(ownerToken),
			body: JSON.stringify({
				name: "Physics 101",
				description: "Week 1",
				color: "#0f766e",
				schoolId: schoolAId,
			}),
		});
		expect(createClassRes.response.status).toBe(201);
		expect(
			(createClassRes.body as { taskAiPrompt: string | null }).taskAiPrompt,
		).toBe(
			"Title tasks by deliverable, not course name. Include topic, artifact, or milestone. Max 12 words.",
		);

		const classId = (createClassRes.body as { id: string }).id;
		const inviteCode = (createClassRes.body as { inviteCode: string })
			.inviteCode;

		const classesList = await app.request("/classes", {
			headers: authHeader(ownerToken),
		});
		expect(classesList.status).toBe(200);

		const refreshInvite = await requestJson(
			app,
			`/classes/${classId}/invite-code`,
			{
				method: "POST",
				headers: authHeader(ownerToken),
				body: JSON.stringify({}),
			},
		);
		expect(refreshInvite.response.status).toBe(200);
		const activeInviteCode = (refreshInvite.body as { inviteCode: string })
			.inviteCode;

		const outsiderJoinFail = await requestJson(app, "/classes/join", {
			method: "POST",
			headers: authHeader(outsiderToken),
			body: JSON.stringify({ inviteCode: activeInviteCode }),
		});
		expect(outsiderJoinFail.response.status).toBe(403);

		const memberJoin = await requestJson(app, "/classes/join", {
			method: "POST",
			headers: authHeader(memberToken),
			body: JSON.stringify({ inviteCode: activeInviteCode }),
		});
		expect(memberJoin.response.status).toBe(200);

		const duplicateJoin = await requestJson(app, "/classes/join", {
			method: "POST",
			headers: authHeader(memberToken),
			body: JSON.stringify({ inviteCode: activeInviteCode }),
		});
		expect(duplicateJoin.response.status).toBe(409);

		const classDetail = await app.request(`/classes/${classId}`, {
			headers: authHeader(memberToken),
		});
		expect(classDetail.status).toBe(200);
		expect(
			((await classDetail.json()) as { taskAiPrompt: string | null })
				.taskAiPrompt,
		).toBeNull();

		const classPatch = await requestJson(app, `/classes/${classId}`, {
			method: "PATCH",
			headers: authHeader(ownerToken),
			body: JSON.stringify({ description: "Updated description" }),
		});
		expect(classPatch.response.status).toBe(200);
		expect((classPatch.body as { schoolId: string | null }).schoolId).toBe(
			schoolAId,
		);
		expect(
			(classPatch.body as { taskAiPrompt: string | null }).taskAiPrompt,
		).toBe(
			"Title tasks by deliverable, not course name. Include topic, artifact, or milestone. Max 12 words.",
		);

		const promptPatch = await requestJson(app, `/classes/${classId}`, {
			method: "PATCH",
			headers: authHeader(ownerToken),
			body: JSON.stringify({ taskAiPrompt: "Prefer rubric-style titles." }),
		});
		expect(promptPatch.response.status).toBe(200);
		expect(
			(promptPatch.body as { taskAiPrompt: string | null }).taskAiPrompt,
		).toBe("Prefer rubric-style titles.");

		const clearPromptPatch = await requestJson(app, `/classes/${classId}`, {
			method: "PATCH",
			headers: authHeader(ownerToken),
			body: JSON.stringify({ taskAiPrompt: "   " }),
		});
		expect(clearPromptPatch.response.status).toBe(200);
		expect(
			(clearPromptPatch.body as { taskAiPrompt: string | null }).taskAiPrompt,
		).toBeNull();

		const longPromptPatch = await requestJson(app, `/classes/${classId}`, {
			method: "PATCH",
			headers: authHeader(ownerToken),
			body: JSON.stringify({ taskAiPrompt: "x".repeat(2001) }),
		});
		expect(longPromptPatch.response.status).toBe(400);

		const clearClassSchool = await requestJson(app, `/classes/${classId}`, {
			method: "PATCH",
			headers: authHeader(ownerToken),
			body: JSON.stringify({ schoolId: null }),
		});
		expect(clearClassSchool.response.status).toBe(200);
		expect(
			(clearClassSchool.body as { schoolId: string | null }).schoolId,
		).toBeNull();

		const outsiderJoinAfterClear = await requestJson(app, "/classes/join", {
			method: "POST",
			headers: authHeader(outsiderToken),
			body: JSON.stringify({ inviteCode: activeInviteCode }),
		});
		expect(outsiderJoinAfterClear.response.status).toBe(200);

		const membersList = await app.request(`/classes/${classId}/members`, {
			headers: authHeader(ownerToken),
		});
		expect(membersList.status).toBe(200);

		const memberPromote = await requestJson(
			app,
			`/classes/${classId}/members/${memberUserId}`,
			{
				method: "PATCH",
				headers: authHeader(ownerToken),
				body: JSON.stringify({ role: "ADMIN" }),
			},
		);
		expect(memberPromote.response.status).toBe(200);

		const memberDemote = await requestJson(
			app,
			`/classes/${classId}/members/${memberUserId}`,
			{
				method: "PATCH",
				headers: authHeader(ownerToken),
				body: JSON.stringify({ role: "MEMBER" }),
			},
		);
		expect(memberDemote.response.status).toBe(200);

		const thirdEmail = uniqueEmail("third");
		const thirdRegister = await createTestUser({
			email: thirdEmail,
			password: "Passw0rd!",
			schoolId: schoolAId,
			studentId: "1333",
		});
		const thirdToken = thirdRegister.token;
		const thirdUserId = thirdRegister.user.id;

		await requestJson(app, "/classes/join", {
			method: "POST",
			headers: authHeader(thirdToken),
			body: JSON.stringify({ inviteCode: activeInviteCode }),
		});

		const ownerRemoveThird = await requestJson(
			app,
			`/classes/${classId}/members/${thirdUserId}`,
			{
				method: "DELETE",
				headers: authHeader(ownerToken),
			},
		);
		expect(ownerRemoveThird.response.status).toBe(204);

		const equalTaskTime = new Date(Date.now() + 172_800_000).toISOString();
		const createEqualTimeTask = await requestJson(
			app,
			`/classes/${classId}/tasks`,
			{
				method: "POST",
				headers: authHeader(ownerToken),
				body: JSON.stringify({
					title: "Equal time task",
					startAt: equalTaskTime,
					dueAt: equalTaskTime,
				}),
			},
		);
		expect(createEqualTimeTask.response.status).toBe(201);

		const createInvalidTimeTask = await requestJson(
			app,
			`/classes/${classId}/tasks`,
			{
				method: "POST",
				headers: authHeader(ownerToken),
				body: JSON.stringify({
					title: "Invalid time task",
					startAt: new Date(Date.now() + 172_800_000).toISOString(),
					dueAt: new Date(Date.now() + 86_400_000).toISOString(),
				}),
			},
		);
		expect(createInvalidTimeTask.response.status).toBe(400);

		const createTaskRes = await requestJson(app, `/classes/${classId}/tasks`, {
			method: "POST",
			headers: authHeader(ownerToken),
			body: JSON.stringify({
				title: "Task 1",
				description: "Solve chapter 1",
				dueAt: new Date(Date.now() + 86_400_000).toISOString(),
				allowLateSubmission: true,
			}),
		});
		expect(createTaskRes.response.status).toBe(201);

		const taskId = (createTaskRes.body as { id: string }).id;

		const updateInvalidTimeTask = await requestJson(app, `/tasks/${taskId}`, {
			method: "PATCH",
			headers: authHeader(ownerToken),
			body: JSON.stringify({
				startAt: new Date(Date.now() + 172_800_000).toISOString(),
				dueAt: new Date(Date.now() + 86_400_000).toISOString(),
			}),
		});
		expect(updateInvalidTimeTask.response.status).toBe(400);

		const createDraftRes = await requestJson(
			app,
			`/classes/${classId}/tasks/drafts`,
			{
				method: "POST",
				headers: authHeader(ownerToken),
				body: JSON.stringify({
					sourceText: "Finish the worksheet by this Sunday evening",
				}),
			},
		);
		expect(createDraftRes.response.status).toBe(201);
		const draftTaskId = (createDraftRes.body as { id: string }).id;

		const listTasks = await app.request(`/classes/${classId}/tasks`, {
			headers: authHeader(memberToken),
		});
		expect(listTasks.status).toBe(200);
		const listTaskBody = (await json(listTasks)) as Array<{ id: string }>;
		expect(listTaskBody.some((task) => task.id === draftTaskId)).toBe(false);

		const memberGetDraftTask = await app.request(`/tasks/${draftTaskId}`, {
			headers: authHeader(memberToken),
		});
		expect(memberGetDraftTask.status).toBe(404);

		const parseDraftTask = await requestJson(
			app,
			`/tasks/${draftTaskId}/parse`,
			{
				method: "POST",
				headers: authHeader(ownerToken),
				body: JSON.stringify({
					text: "Finish the worksheet by this Sunday evening",
				}),
			},
		);
		expect(parseDraftTask.response.status).toBe(200);

		const draftTaskWithAttachmentRes = await requestJson(
			app,
			`/classes/${classId}/tasks/drafts`,
			{
				method: "POST",
				headers: authHeader(ownerToken),
				body: JSON.stringify({ sourceText: null }),
			},
		);
		expect(draftTaskWithAttachmentRes.response.status).toBe(201);
		const draftTaskWithAttachmentId = (
			draftTaskWithAttachmentRes.body as { id: string }
		).id;

		await uploadAttachmentDirect({
			uploadUrlPath: `/tasks/${draftTaskWithAttachmentId}/attachments/upload-url`,
			completePath: `/tasks/${draftTaskWithAttachmentId}/attachments`,
			token: ownerToken,
			fileName: "draft-only.txt",
			content: "draft-only-attachment",
			mimeType: "text/plain",
		});

		const parseDraftTaskWithAttachmentOnly = await requestJson(
			app,
			`/tasks/${draftTaskWithAttachmentId}/parse`,
			{
				method: "POST",
				headers: authHeader(ownerToken),
				body: JSON.stringify({}),
			},
		);
		expect(parseDraftTaskWithAttachmentOnly.response.status).toBe(200);

		const draftMarkdown = await app.request(
			`/tasks/${draftTaskId}/draft-markdown`,
			{
				headers: authHeader(ownerToken),
			},
		);
		expect(draftMarkdown.status).toBe(200);

		const publishDraftTask = await requestJson(
			app,
			`/tasks/${draftTaskId}/publish`,
			{
				method: "POST",
				headers: authHeader(ownerToken),
				body: JSON.stringify({ title: "Worksheet Draft Published" }),
			},
		);
		expect(publishDraftTask.response.status).toBe(200);

		const memberGetPublishedDraftTask = await app.request(
			`/tasks/${draftTaskId}`,
			{ headers: authHeader(memberToken) },
		);
		expect(memberGetPublishedDraftTask.status).toBe(200);

		const parseTask = await requestJson(app, "/tasks/parse", {
			method: "POST",
			headers: authHeader(ownerToken),
			body: JSON.stringify({ text: "Math homework due tomorrow" }),
		});
		expect(parseTask.response.status).toBe(200);

		const getTask = await app.request(`/tasks/${taskId}`, {
			headers: authHeader(ownerToken),
		});
		expect(getTask.status).toBe(200);

		const patchTask = await requestJson(app, `/tasks/${taskId}`, {
			method: "PATCH",
			headers: authHeader(ownerToken),
			body: JSON.stringify({ title: "Task 1 updated", blockedBy: [] }),
		});
		expect(patchTask.response.status).toBe(200);

		const taskView = await requestJson(app, `/tasks/${taskId}/view`, {
			method: "POST",
			headers: authHeader(memberToken),
			body: JSON.stringify({}),
		});
		expect(taskView.response.status).toBe(204);

		const taskState = await requestJson(app, `/tasks/${taskId}/state`, {
			method: "PATCH",
			headers: authHeader(memberToken),
			body: JSON.stringify({ tags: ["urgent"], sortOrder: 1 }),
		});
		expect(taskState.response.status).toBe(200);

		const archiveTaskState = await requestJson(app, `/tasks/${taskId}/state`, {
			method: "PATCH",
			headers: authHeader(memberToken),
			body: JSON.stringify({ tags: ["urgent", "__archived__"] }),
		});
		expect(archiveTaskState.response.status).toBe(200);
		expect(
			(
				archiveTaskState.body as {
					tags: string[];
					sortOrder: number;
					viewedAt: string | null;
					submittedAt: string | null;
				}
			).tags,
		).toEqual(["urgent", "__archived__"]);
		expect(
			(
				archiveTaskState.body as {
					tags: string[];
					sortOrder: number;
					viewedAt: string | null;
					submittedAt: string | null;
				}
			).sortOrder,
		).toBe(1);
		expect(
			(
				archiveTaskState.body as {
					tags: string[];
					sortOrder: number;
					viewedAt: string | null;
					submittedAt: string | null;
				}
			).viewedAt,
		).toBeTruthy();

		const archivedTaskDetail = await requestJson(app, `/tasks/${taskId}`, {
			headers: authHeader(memberToken),
		});
		expect(archivedTaskDetail.response.status).toBe(200);
		expect(
			(
				archivedTaskDetail.body as {
					userState: { tags: string[]; sortOrder: number };
				}
			).userState.tags,
		).toContain("__archived__");

		const unarchiveTaskState = await requestJson(
			app,
			`/tasks/${taskId}/state`,
			{
				method: "PATCH",
				headers: authHeader(memberToken),
				body: JSON.stringify({ tags: ["urgent"] }),
			},
		);
		expect(unarchiveTaskState.response.status).toBe(200);
		expect(
			(
				unarchiveTaskState.body as {
					tags: string[];
					sortOrder: number;
					viewedAt: string | null;
					submittedAt: string | null;
				}
			).tags,
		).toEqual(["urgent"]);
		expect(
			(
				unarchiveTaskState.body as {
					tags: string[];
					sortOrder: number;
					viewedAt: string | null;
					submittedAt: string | null;
				}
			).sortOrder,
		).toBe(1);

		const unarchivedTaskDetail = await requestJson(app, `/tasks/${taskId}`, {
			headers: authHeader(memberToken),
		});
		expect(unarchivedTaskDetail.response.status).toBe(200);
		expect(
			(
				unarchivedTaskDetail.body as {
					userState: { tags: string[]; sortOrder: number };
				}
			).userState.tags,
		).not.toContain("__archived__");

		const memberTaskUploadUrlFail = await requestJson(
			app,
			`/tasks/${taskId}/attachments/upload-url`,
			{
				method: "POST",
				headers: authHeader(memberToken),
				body: JSON.stringify({
					files: [
						{ name: "member-task.txt", mimeType: "text/plain", sizeBytes: 4 },
					],
				}),
			},
		);
		expect(memberTaskUploadUrlFail.response.status).toBe(403);

		const missingTaskUploadUrl = await requestJson(
			app,
			`/tasks/${taskId}/attachments/upload-url`,
			{
				method: "POST",
				headers: authHeader(ownerToken),
				body: JSON.stringify({
					files: [
						{ name: "missing.txt", mimeType: "text/plain", sizeBytes: 7 },
					],
				}),
			},
		);
		expect(missingTaskUploadUrl.response.status).toBe(200);
		const [missingTaskUpload] =
			missingTaskUploadUrl.body as DirectUploadTarget[];
		if (!missingTaskUpload) {
			throw new Error("Missing task upload URL");
		}
		const missingComplete = await requestJson(
			app,
			`/tasks/${taskId}/attachments`,
			{
				method: "POST",
				headers: authHeader(ownerToken),
				body: JSON.stringify({
					attachments: [
						{
							fileKey: missingTaskUpload.fileKey,
							originalName: "missing.txt",
							mimeType: "text/plain",
							sizeBytes: 7,
						},
					],
				}),
			},
		);
		expect(missingComplete.response.status).toBe(400);
		expect((missingComplete.body as { code?: string }).code).toBe(
			"UPLOAD_NOT_FOUND",
		);

		const taskAttachmentBody = (await uploadAttachmentDirect({
			uploadUrlPath: `/tasks/${taskId}/attachments/upload-url`,
			completePath: `/tasks/${taskId}/attachments`,
			token: ownerToken,
			fileName: "task.txt",
			content: "task-file",
			mimeType: "text/plain",
		})) as Array<{
			id: string;
			fileKey: string;
			isVisible: boolean;
		}>;
		expect(taskAttachmentBody[0]?.isVisible).toBe(true);

		const hiddenTaskAttachmentBody = (await uploadAttachmentDirect({
			uploadUrlPath: `/tasks/${taskId}/attachments/upload-url`,
			completePath: `/tasks/${taskId}/attachments`,
			token: ownerToken,
			fileName: "task-hidden.txt",
			content: "task-hidden-file",
			mimeType: "text/plain",
			isVisible: false,
		})) as Array<{
			id: string;
			fileKey: string;
			isVisible: boolean;
		}>;
		expect(hiddenTaskAttachmentBody[0]?.isVisible).toBe(false);

		const memberTaskDetailBeforeHide = await requestJson(
			app,
			`/tasks/${taskId}`,
			{
				method: "GET",
				headers: authHeader(memberToken),
			},
		);
		expect(memberTaskDetailBeforeHide.response.status).toBe(200);
		expect(
			(
				memberTaskDetailBeforeHide.body as {
					attachments: Array<{ id: string }>;
				}
			).attachments.length,
		).toBe(1);

		const memberToggleHidden = await requestJson(
			app,
			`/files/attachments/${hiddenTaskAttachmentBody[0]?.id}`,
			{
				method: "PATCH",
				headers: authHeader(memberToken),
				body: JSON.stringify({ isVisible: true }),
			},
		);
		expect(memberToggleHidden.response.status).toBe(403);

		const ownerToggleVisibleToHidden = await requestJson(
			app,
			`/files/attachments/${taskAttachmentBody[0]?.id}`,
			{
				method: "PATCH",
				headers: authHeader(ownerToken),
				body: JSON.stringify({ isVisible: false }),
			},
		);
		expect(ownerToggleVisibleToHidden.response.status).toBe(200);
		expect(
			(ownerToggleVisibleToHidden.body as { isVisible: boolean }).isVisible,
		).toBe(false);

		const memberTaskDetailAfterHide = await requestJson(
			app,
			`/tasks/${taskId}`,
			{
				method: "GET",
				headers: authHeader(memberToken),
			},
		);
		expect(memberTaskDetailAfterHide.response.status).toBe(200);
		expect(
			(
				memberTaskDetailAfterHide.body as {
					attachments: Array<{ id: string }>;
				}
			).attachments.length,
		).toBe(0);

		const ownerTaskDetailAfterHide = await requestJson(
			app,
			`/tasks/${taskId}`,
			{
				method: "GET",
				headers: authHeader(ownerToken),
			},
		);
		expect(ownerTaskDetailAfterHide.response.status).toBe(200);
		expect(
			(
				ownerTaskDetailAfterHide.body as {
					attachments: Array<{ id: string }>;
				}
			).attachments.length,
		).toBe(2);

		const ownerHiddenFileRes = await app.request(
			`/files/${encodeURIComponent(hiddenTaskAttachmentBody[0].fileKey)}`,
			{
				headers: authHeader(ownerToken),
			},
		);
		expect(ownerHiddenFileRes.status).toBe(302);

		const submitTextRes = await requestJson(
			app,
			`/tasks/${taskId}/submissions/me`,
			{
				method: "PUT",
				headers: authHeader(memberToken),
				body: JSON.stringify({ content: "My first answer" }),
			},
		);
		expect(submitTextRes.response.status).toBe(200);
		expect((submitTextRes.body as { content: string | null }).content).toBe(
			"My first answer",
		);

		const submitBody = (await uploadAttachmentDirect({
			uploadUrlPath: `/tasks/${taskId}/submissions/me/attachments/upload-url`,
			completePath: `/tasks/${taskId}/submissions/me/attachments`,
			token: memberToken,
			fileName: "submission.txt",
			content: "submission-file",
			mimeType: "text/plain",
		})) as Array<{ fileKey: string }>;
		expect(submitBody.length).toBe(1);

		const mySubmissionRes = await app.request(
			`/tasks/${taskId}/submissions/me`,
			{ headers: authHeader(memberToken) },
		);
		expect(mySubmissionRes.status).toBe(200);
		const mySubmissionBody = (await json(mySubmissionRes)) as {
			id: string;
			content: string | null;
			attachments: Array<{ fileKey: string }>;
		};
		const submissionId = mySubmissionBody.id;
		expect(mySubmissionBody.content).toBe("My first answer");
		expect(mySubmissionBody.attachments.length).toBe(1);

		const submissionDetailRes = await app.request(
			`/tasks/${taskId}/submissions/${submissionId}`,
			{
				headers: authHeader(ownerToken),
			},
		);
		expect(submissionDetailRes.status).toBe(200);
		const submissionDetailBody = (await json(submissionDetailRes)) as {
			content: string | null;
			attachments: Array<{ fileKey: string }>;
		};
		expect(submissionDetailBody.content).toBe("My first answer");
		expect(submissionDetailBody.attachments.length).toBe(1);

		const submissionDetailForbiddenRes = await app.request(
			`/tasks/${taskId}/submissions/${submissionId}`,
			{
				headers: authHeader(memberToken),
			},
		);
		expect(submissionDetailForbiddenRes.status).toBe(403);

		const allSubmissions = await app.request(`/tasks/${taskId}/submissions`, {
			headers: authHeader(ownerToken),
		});
		expect(allSubmissions.status).toBe(200);

		const gradeRes = await requestJson(
			app,
			`/tasks/${taskId}/submissions/${submissionId}/grade`,
			{
				method: "PATCH",
				headers: authHeader(ownerToken),
				body: JSON.stringify({ score: "95.50", reviewNote: "Good work" }),
			},
		);
		expect(gradeRes.response.status).toBe(200);

		const exportCsv = await app.request(`/tasks/${taskId}/submissions/export`, {
			headers: authHeader(ownerToken),
		});
		expect(exportCsv.status).toBe(200);
		const csvText = await exportCsv.text();
		expect(csvText.includes("任务名称")).toBe(true);

		const renameRes = await requestJson(
			app,
			`/tasks/${taskId}/submissions/rename`,
			{
				method: "POST",
				headers: authHeader(ownerToken),
				body: JSON.stringify({}),
			},
		);
		expect(renameRes.response.status).toBe(204);

		const fileTaskRes = await app.request(
			`/files/${encodeURIComponent(taskAttachmentBody[0].fileKey)}`,
			{
				headers: authHeader(memberToken),
			},
		);
		expect(fileTaskRes.status).toBe(302);

		const fileSubmissionRes = await app.request(
			`/files/${encodeURIComponent(submitBody[0].fileKey)}`,
			{
				headers: authHeader(ownerToken),
			},
		);
		expect(fileSubmissionRes.status).toBe(302);

		const transferRes = await requestJson(app, `/classes/${classId}/transfer`, {
			method: "POST",
			headers: authHeader(ownerToken),
			body: JSON.stringify({ newOwnerId: memberUserId }),
		});
		expect(transferRes.response.status).toBe(200);

		const deleteClassRes = await requestJson(app, `/classes/${classId}`, {
			method: "DELETE",
			headers: authHeader(memberToken),
			body: JSON.stringify({}),
		});
		expect(deleteClassRes.response.status).toBe(204);

		const orphanTask = await prisma.task.findUnique({ where: { id: taskId } });
		expect(orphanTask).not.toBeNull();
		expect(orphanTask?.classId).toBeNull();

		const orphanSubmission = await prisma.submission.findUnique({
			where: { id: submissionId },
		});
		expect(orphanSubmission).not.toBeNull();

		const deleteTaskRes = await requestJson(app, `/tasks/${taskId}`, {
			method: "DELETE",
			headers: authHeader(memberToken),
			body: JSON.stringify({}),
		});
		expect(deleteTaskRes.response.status).toBe(403);

		const listAdminUsersRes = await app.request("/admin/users", {
			headers: { Authorization: `Bearer ${adminToken}` },
		});
		expect(listAdminUsersRes.status).toBe(200);

		const disableUserRes = await requestJson(
			app,
			`/admin/users/${outsiderUserId}`,
			{
				method: "PATCH",
				headers: { Authorization: `Bearer ${adminToken}` },
				body: JSON.stringify({ isActive: false }),
			},
		);
		expect(disableUserRes.response.status).toBe(200);

		const disabledLogin = await requestJson(app, "/auth/login", {
			method: "POST",
			body: JSON.stringify({ email: outsiderEmail, password: "Passw0rd!" }),
		});
		expect(disabledLogin.response.status).toBe(403);

		const reenableUserRes = await requestJson(
			app,
			`/admin/users/${outsiderUserId}`,
			{
				method: "PATCH",
				headers: { Authorization: `Bearer ${adminToken}` },
				body: JSON.stringify({ isActive: true, password: "Passw0rd!" }),
			},
		);
		expect(reenableUserRes.response.status).toBe(200);

		const deleteOutsider = await requestJson(
			app,
			`/admin/users/${outsiderUserId}`,
			{
				method: "DELETE",
				headers: { Authorization: `Bearer ${adminToken}` },
				body: JSON.stringify({}),
			},
		);
		expect(deleteOutsider.response.status).toBe(204);

		const listSchoolsAdmin = await app.request("/admin/schools", {
			headers: { Authorization: `Bearer ${adminToken}` },
		});
		expect(listSchoolsAdmin.status).toBe(200);

		const deleteSchool = await requestJson(app, `/admin/schools/${schoolBId}`, {
			method: "DELETE",
			headers: { Authorization: `Bearer ${adminToken}` },
			body: JSON.stringify({}),
		});
		expect(deleteSchool.response.status).toBe(204);

		const deleteMyAccountRes = await requestJson(app, "/users/me/delete", {
			method: "POST",
			headers: authHeader(tempToken),
			body: JSON.stringify({}),
		});
		expect(deleteMyAccountRes.response.status).toBe(204);

		const oldInviteJoin = await requestJson(app, "/classes/join", {
			method: "POST",
			headers: authHeader(memberToken),
			body: JSON.stringify({ inviteCode }),
		});
		expect([404, 409]).toContain(oldInviteJoin.response.status);

		expect(ownerUserId).not.toBe(memberUserId);
	});

	it("lists and imports published tasks for managed classes", async () => {
		const owner = await createTestUser({ emailPrefix: "import-owner" });
		const member = await createTestUser({ emailPrefix: "import-member" });

		const classRow = await prisma.class.create({
			data: {
				name: "Import Source Class",
				ownerId: owner.user.id,
				color: "#7B6CB0",
				members: {
					create: [
						{ userId: owner.user.id, role: ClassRole.OWNER },
						{ userId: member.user.id, role: ClassRole.MEMBER },
					],
				},
			},
		});

		const olderTask = await requestJson(app, `/classes/${classRow.id}/tasks`, {
			method: "POST",
			headers: authHeader(owner.token),
			body: JSON.stringify({
				title: "Older import source",
				description: "Older description text",
				dueAt: new Date(Date.now() + 86_400_000).toISOString(),
			}),
		});
		expect(olderTask.response.status).toBe(201);

		const newerTask = await requestJson(app, `/classes/${classRow.id}/tasks`, {
			method: "POST",
			headers: authHeader(owner.token),
			body: JSON.stringify({
				title: "Newer import source",
				description: "Newer body text",
				sourceText: "Newer source text",
				dueAt: new Date(Date.now() + 172_800_000).toISOString(),
			}),
		});
		expect(newerTask.response.status).toBe(201);

		const olderTaskId = (olderTask.body as { id: string }).id;
		const newerTaskId = (newerTask.body as { id: string }).id;

		await prisma.task.update({
			where: { id: olderTaskId },
			data: { updatedAt: new Date("2026-01-01T00:00:00.000Z") },
		});
		await prisma.task.update({
			where: { id: newerTaskId },
			data: { updatedAt: new Date("2026-01-02T00:00:00.000Z") },
		});

		const sourceAttachment = (await uploadAttachmentDirect({
			uploadUrlPath: `/tasks/${newerTaskId}/attachments/upload-url`,
			completePath: `/tasks/${newerTaskId}/attachments`,
			token: owner.token,
			fileName: "source.txt",
			content: "source attachment",
			mimeType: "text/plain",
		})) as Array<{ fileKey: string }>;

		const ownerCandidates = await requestJson(
			app,
			"/tasks/import-candidates?sort=updatedAt",
			{ headers: authHeader(owner.token) },
		);
		expect(ownerCandidates.response.status).toBe(200);
		const candidateBody = ownerCandidates.body as {
			tasks: Array<{
				id: string;
				classId: string;
				attachmentCount: number;
			}>;
		};
		expect(candidateBody.tasks.map((task) => task.id)).toEqual([
			newerTaskId,
			olderTaskId,
		]);
		expect(candidateBody.tasks[0]).toMatchObject({
			classId: classRow.id,
			attachmentCount: 1,
		});
		expect(candidateBody.tasks[0]).not.toHaveProperty("body");
		expect(candidateBody.tasks[0]).not.toHaveProperty("sourceText");

		const detailRes = await requestJson(
			app,
			`/tasks/import-candidates/${newerTaskId}`,
			{ headers: authHeader(owner.token) },
		);
		expect(detailRes.response.status).toBe(200);
		expect(detailRes.body).toMatchObject({
			id: newerTaskId,
			body: "Newer body text",
			attachments: [{ originalName: "source.txt" }],
		});

		const memberDetailRes = await requestJson(
			app,
			`/tasks/import-candidates/${newerTaskId}`,
			{ headers: authHeader(member.token) },
		);
		expect(memberDetailRes.response.status).toBe(403);

		const memberCandidates = await requestJson(
			app,
			"/tasks/import-candidates",
			{
				headers: authHeader(member.token),
			},
		);
		expect(memberCandidates.response.status).toBe(200);
		expect((memberCandidates.body as { tasks: unknown[] }).tasks).toHaveLength(
			0,
		);

		const draft = await requestJson(
			app,
			`/classes/${classRow.id}/tasks/drafts`,
			{
				method: "POST",
				headers: authHeader(owner.token),
				body: JSON.stringify({ sourceText: "Current draft text" }),
			},
		);
		expect(draft.response.status).toBe(201);
		const draftTaskId = (draft.body as { id: string }).id;

		const importRes = await requestJson(app, `/tasks/${draftTaskId}/import`, {
			method: "POST",
			headers: authHeader(owner.token),
			body: JSON.stringify({ sourceTaskId: newerTaskId }),
		});
		expect(importRes.response.status).toBe(201);
		const importBody = importRes.body as {
			attachments: Array<{ fileKey: string; originalName: string }>;
		};
		expect(importBody).not.toHaveProperty("body");
		expect(importBody).not.toHaveProperty("sourceText");
		expect(importBody.attachments).toHaveLength(1);
		expect(importBody.attachments[0]).toMatchObject({
			originalName: "source.txt",
		});
		expect(importBody.attachments[0]?.fileKey).not.toBe(
			sourceAttachment[0]?.fileKey,
		);
		expect(importBody.attachments[0]?.fileKey).toMatch(
			new RegExp(`^tasks/${draftTaskId}/`),
		);

		const sourceAttachments = await prisma.attachment.findMany({
			where: { taskId: newerTaskId },
		});
		const copiedAttachments = await prisma.attachment.findMany({
			where: { taskId: draftTaskId },
		});
		expect(sourceAttachments.map((a) => a.fileKey)).toEqual([
			sourceAttachment[0]?.fileKey,
		]);
		expect(copiedAttachments.map((a) => a.fileKey)).toEqual([
			importBody.attachments[0]?.fileKey,
		]);
	});

	it("enforces allowLateSubmission for student submission mutations", async () => {
		const owner = await createTestUser({ emailPrefix: "late-owner" });
		const member = await createTestUser({ emailPrefix: "late-member" });
		const classRow = await prisma.class.create({
			data: {
				name: "Late Submission Class",
				ownerId: owner.user.id,
				color: "#7B6CB0",
				members: {
					create: [
						{ userId: owner.user.id, role: ClassRole.OWNER },
						{ userId: member.user.id, role: ClassRole.MEMBER },
					],
				},
			},
		});

		async function createTask(input: {
			dueAt: Date;
			allowLateSubmission: boolean;
		}) {
			return prisma.task.create({
				data: {
					classId: classRow.id,
					createdBy: owner.user.id,
					title: "Late policy task",
					description: "Check late policy",
					startAt: new Date(Date.now() - 3_600_000),
					dueAt: input.dueAt,
					allowLateSubmission: input.allowLateSubmission,
					blockedBy: [],
					isPublished: true,
					publishedAt: new Date(Date.now() - 3_600_000),
				},
			});
		}

		const lockedTask = await createTask({
			dueAt: new Date(Date.now() - 3_600_000),
			allowLateSubmission: false,
		});

		const lateCreateRes = await requestJson(
			app,
			`/tasks/${lockedTask.id}/submissions/me`,
			{
				method: "PUT",
				headers: authHeader(member.token),
				body: JSON.stringify({ content: "too late" }),
			},
		);
		expect(lateCreateRes.response.status).toBe(403);
		expect((lateCreateRes.body as { code: string }).code).toBe(
			"LATE_SUBMISSION_CLOSED",
		);

		const previouslyOpenTask = await createTask({
			dueAt: new Date(Date.now() + 3_600_000),
			allowLateSubmission: false,
		});

		const firstSubmitRes = await requestJson(
			app,
			`/tasks/${previouslyOpenTask.id}/submissions/me`,
			{
				method: "PUT",
				headers: authHeader(member.token),
				body: JSON.stringify({ content: "before deadline" }),
			},
		);
		expect(firstSubmitRes.response.status).toBe(200);

		await prisma.task.update({
			where: { id: previouslyOpenTask.id },
			data: { dueAt: new Date(Date.now() - 3_600_000) },
		});

		const lateEditRes = await requestJson(
			app,
			`/tasks/${previouslyOpenTask.id}/submissions/me`,
			{
				method: "PUT",
				headers: authHeader(member.token),
				body: JSON.stringify({ content: "after deadline" }),
			},
		);
		expect(lateEditRes.response.status).toBe(403);
		expect((lateEditRes.body as { code: string }).code).toBe(
			"LATE_SUBMISSION_CLOSED",
		);

		const uploadUrlAfterDeadline = await requestJson(
			app,
			`/tasks/${previouslyOpenTask.id}/submissions/me/attachments/upload-url`,
			{
				method: "POST",
				headers: authHeader(member.token),
				body: JSON.stringify({
					files: [
						{
							name: "late.txt",
							mimeType: "text/plain",
							sizeBytes: 4,
						},
					],
				}),
			},
		);
		expect(uploadUrlAfterDeadline.response.status).toBe(403);
		expect((uploadUrlAfterDeadline.body as { code: string }).code).toBe(
			"LATE_SUBMISSION_CLOSED",
		);

		const completionTask = await createTask({
			dueAt: new Date(Date.now() + 3_600_000),
			allowLateSubmission: false,
		});
		const uploadUrlBeforeDeadline = await requestJson(
			app,
			`/tasks/${completionTask.id}/submissions/me/attachments/upload-url`,
			{
				method: "POST",
				headers: authHeader(member.token),
				body: JSON.stringify({
					files: [
						{
							name: "race.txt",
							mimeType: "text/plain",
							sizeBytes: 4,
						},
					],
				}),
			},
		);
		expect(uploadUrlBeforeDeadline.response.status).toBe(200);
		const [upload] = uploadUrlBeforeDeadline.body as DirectUploadTarget[];
		expect(upload).toBeTruthy();
		await fetch(upload.uploadUrl, {
			method: "PUT",
			headers: upload.headers,
			body: Buffer.from("race"),
		});
		await prisma.task.update({
			where: { id: completionTask.id },
			data: { dueAt: new Date(Date.now() - 3_600_000) },
		});
		const completionAfterDeadline = await requestJson(
			app,
			`/tasks/${completionTask.id}/submissions/me/attachments`,
			{
				method: "POST",
				headers: authHeader(member.token),
				body: JSON.stringify({
					attachments: [
						{
							fileKey: upload.fileKey,
							originalName: "race.txt",
							mimeType: "text/plain",
							sizeBytes: 4,
						},
					],
				}),
			},
		);
		expect(completionAfterDeadline.response.status).toBe(403);
		expect((completionAfterDeadline.body as { code: string }).code).toBe(
			"LATE_SUBMISSION_CLOSED",
		);

		const deleteTask = await createTask({
			dueAt: new Date(Date.now() + 3_600_000),
			allowLateSubmission: false,
		});
		const uploaded = (await uploadAttachmentDirect({
			uploadUrlPath: `/tasks/${deleteTask.id}/submissions/me/attachments/upload-url`,
			completePath: `/tasks/${deleteTask.id}/submissions/me/attachments`,
			token: member.token,
			fileName: "delete-me.txt",
			content: "delete",
			mimeType: "text/plain",
		})) as Array<{ id: string }>;
		await prisma.task.update({
			where: { id: deleteTask.id },
			data: { dueAt: new Date(Date.now() - 3_600_000) },
		});
		const deleteAfterDeadline = await app.request(
			`/files/attachments/${uploaded[0].id}`,
			{
				method: "DELETE",
				headers: authHeader(member.token),
			},
		);
		expect(deleteAfterDeadline.status).toBe(403);
		expect(((await json(deleteAfterDeadline)) as { code: string }).code).toBe(
			"LATE_SUBMISSION_CLOSED",
		);

		const allowedLateTask = await createTask({
			dueAt: new Date(Date.now() - 3_600_000),
			allowLateSubmission: true,
		});
		const allowedLateSubmit = await requestJson(
			app,
			`/tasks/${allowedLateTask.id}/submissions/me`,
			{
				method: "PUT",
				headers: authHeader(member.token),
				body: JSON.stringify({ content: "late but allowed" }),
			},
		);
		expect(allowedLateSubmit.response.status).toBe(200);

		const futureClosedTask = await createTask({
			dueAt: new Date(Date.now() + 3_600_000),
			allowLateSubmission: false,
		});
		const futureSubmit = await requestJson(
			app,
			`/tasks/${futureClosedTask.id}/submissions/me`,
			{
				method: "PUT",
				headers: authHeader(member.token),
				body: JSON.stringify({ content: "on time" }),
			},
		);
		expect(futureSubmit.response.status).toBe(200);
	});
});

describe("Session lifecycle", () => {
	beforeEach(async () => {
		await resetDatabase();
	});

	it("invalidates the token after POST /auth/logout", async () => {
		const { token } = await createTestUser({ emailPrefix: "logout" });

		const before = await app.request("/users/me", {
			headers: authHeader(token),
		});
		expect(before.status).toBe(200);

		const logoutRes = await app.request("/auth/logout", {
			method: "POST",
			headers: authHeader(token),
		});
		expect(logoutRes.status).toBe(204);

		const after = await app.request("/users/me", {
			headers: authHeader(token),
		});
		expect(after.status).toBe(401);
	});

	it("returns the same password reset request response for existing and missing emails", async () => {
		const email = uniqueEmail("forgot");
		await createTestUser({ email, password: "Passw0rd!" });

		const existing = await requestJson(app, "/auth/forgot-password", {
			method: "POST",
			body: JSON.stringify({ email }),
		});
		const missing = await requestJson(app, "/auth/forgot-password", {
			method: "POST",
			body: JSON.stringify({ email: uniqueEmail("forgot-missing") }),
		});

		expect(existing.response.status).toBe(200);
		expect(missing.response.status).toBe(200);
		expect(existing.body).toEqual(missing.body);
	});

	it("does not reveal whether an email already exists during registration", async () => {
		const existingEmail = uniqueEmail("register-existing");
		const newEmail = uniqueEmail("register-new");
		const existingUser = await createTestUser({
			email: existingEmail,
			password: "Passw0rd!",
		});
		const responses: Array<{ response: Response; body: unknown }> = [];

		for (let i = 0; i < 6; i += 1) {
			responses.push(
				await requestJson(app, "/auth/register", {
					method: "POST",
					body: JSON.stringify({ email: existingEmail }),
				}),
			);
			responses.push(
				await requestJson(app, "/auth/register", {
					method: "POST",
					body: JSON.stringify({ email: newEmail }),
				}),
			);
		}

		for (const result of responses) {
			expect(result.response.status).toBe(200);
			expect(result.body).toEqual({ message: "Verification email sent" });
		}

		const existingRegistrationAttempts =
			await prisma.emailVerificationToken.count({
				where: {
					email: existingEmail,
					purpose: EmailTokenPurpose.REGISTRATION,
				},
			});
		const newRegistrationAttempts = await prisma.emailVerificationToken.count({
			where: {
				email: newEmail,
				purpose: EmailTokenPurpose.REGISTRATION,
			},
		});
		expect(existingRegistrationAttempts).toBe(5);
		expect(newRegistrationAttempts).toBe(5);

		const newRegistrationToken =
			await prisma.emailVerificationToken.findFirstOrThrow({
				where: {
					email: newEmail,
					purpose: EmailTokenPurpose.REGISTRATION,
				},
				orderBy: { createdAt: "desc" },
			});
		expect(newRegistrationToken.userId).toBeNull();

		const existingResetToken =
			await prisma.emailVerificationToken.findFirstOrThrow({
				where: {
					email: existingEmail,
					purpose: EmailTokenPurpose.PASSWORD_RESET,
				},
				orderBy: { createdAt: "desc" },
			});
		expect(existingResetToken.userId).toBe(existingUser.user.id);

		const verifyReset = await requestJson(
			app,
			`/auth/verify-token?purpose=PASSWORD_RESET&token=${existingResetToken.token}`,
		);
		expect(verifyReset.response.status).toBe(200);
		expect(verifyReset.body).toEqual({ valid: true, email: existingEmail });

		const directSignIn = await requestJson(
			app,
			"/auth/reset-password/sign-in",
			{
				method: "POST",
				body: JSON.stringify({ token: existingResetToken.token }),
			},
		);
		expect(directSignIn.response.status).toBe(200);
		expect((directSignIn.body as { user: { email: string } }).user.email).toBe(
			existingEmail,
		);
	});

	it("normalizes email addresses across registration and login", async () => {
		const rawEmail = `  Normalize.${Date.now()}@Example.COM  `;
		const normalizedEmail = rawEmail.trim().toLowerCase();
		const created = await createTestUser({
			email: rawEmail,
			password: "Passw0rd!",
		});

		expect(created.user.email).toBe(normalizedEmail);

		const storedUser = await prisma.user.findUnique({
			where: { email: normalizedEmail },
		});
		expect(storedUser).not.toBeNull();

		const loginRes = await requestJson(app, "/auth/login", {
			method: "POST",
			body: JSON.stringify({
				email: ` ${normalizedEmail.toUpperCase()} `,
				password: "Passw0rd!",
			}),
		});

		expect(loginRes.response.status).toBe(200);
	});

	it("logs in users with bcryptjs-generated legacy password hashes", async () => {
		const email = uniqueEmail("legacy-bcryptjs");
		await createTestUser({ email, password: "Temporary1!" });
		const legacyBcryptjsHash =
			"$2b$10$poJpCmMkcrrNE8Ss9/6AJ.bjppNTIDpPE1QbCs6gKOnAvwkqmSVdK";

		const user = await prisma.user.findUniqueOrThrow({ where: { email } });
		await prisma.userCredential.update({
			where: {
				userId_provider: {
					userId: user.id,
					provider: AuthProvider.LOCAL,
				},
			},
			data: { passwordHash: legacyBcryptjsHash },
		});

		const loginRes = await requestJson(app, "/auth/login", {
			method: "POST",
			body: JSON.stringify({ email, password: "Passw0rd!" }),
		});

		expect(loginRes.response.status).toBe(200);
	});

	it("rate limits repeated invalid login attempts from the same IP", async () => {
		const email = uniqueEmail("login-rate-limit");
		await createTestUser({ email, password: "Passw0rd!" });
		const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;

		for (let i = 0; i < 49; i += 1) {
			const invalid = await requestJson(app, "/auth/login", {
				method: "POST",
				headers: { "X-Forwarded-For": ip },
				body: JSON.stringify({ email, password: "wrong-password" }),
			});
			expect(invalid.response.status).toBe(401);
		}

		const valid = await requestJson(app, "/auth/login", {
			method: "POST",
			headers: { "X-Forwarded-For": ip },
			body: JSON.stringify({ email, password: "Passw0rd!" }),
		});
		expect(valid.response.status).toBe(200);

		const limited = await requestJson(app, "/auth/login", {
			method: "POST",
			headers: { "X-Forwarded-For": ip },
			body: JSON.stringify({ email, password: "wrong-password" }),
		});
		expect(limited.response.status).toBe(429);
		expect((limited.body as { code: string }).code).toBe("LOGIN_RATE_LIMITED");

		const stillLimited = await requestJson(app, "/auth/login", {
			method: "POST",
			headers: { "X-Forwarded-For": ip },
			body: JSON.stringify({ email, password: "Passw0rd!" }),
		});
		expect(stillLimited.response.status).toBe(429);
	});

	it("changing password keeps current session alive and kicks other browser sessions", async () => {
		const email = uniqueEmail("passchange");
		const first = await createTestUser({
			email,
			password: "Passw0rd!",
		});

		// Log in a second time to create a separate browser session.
		const secondLogin = await requestJson(app, "/auth/login", {
			method: "POST",
			body: JSON.stringify({ email, password: "Passw0rd!" }),
		});
		expect(secondLogin.response.status).toBe(200);
		const secondToken = readSessionTokenFromSetCookie(secondLogin.response);
		expect(secondToken).not.toBe(first.token);

		const createKeyRes = await requestJson(app, "/users/me/mcp-keys", {
			method: "POST",
			headers: authHeader(first.token),
			body: JSON.stringify({ name: "CI key" }),
		});
		expect(createKeyRes.response.status).toBe(201);
		const rawMcpKey = (createKeyRes.body as { key: string }).key;

		const mcpExchangeRes = await requestJson(app, "/auth/mcp", {
			method: "POST",
			body: JSON.stringify({ key: rawMcpKey }),
		});
		expect(mcpExchangeRes.response.status).toBe(200);
		const mcpToken = (mcpExchangeRes.body as { token: string }).token;

		// Change password from the first session.
		const patchPassword = await requestJson(app, "/users/me/password", {
			method: "PATCH",
			headers: authHeader(first.token),
			body: JSON.stringify({
				currentPassword: "Passw0rd!",
				newPassword: "Passw0rd!New",
			}),
		});
		expect(patchPassword.response.status).toBe(204);

		// First session (the one that issued the change) is still alive.
		const firstAfter = await app.request("/users/me", {
			headers: authHeader(first.token),
		});
		expect(firstAfter.status).toBe(200);

		// Second session got kicked.
		const secondAfter = await app.request("/users/me", {
			headers: authHeader(secondToken),
		});
		expect(secondAfter.status).toBe(401);

		// MCP sessions remain valid; MCP keys are intentionally unaffected.
		const mcpAfter = await app.request("/users/me", {
			headers: authHeader(mcpToken),
		});
		expect(mcpAfter.status).toBe(200);
	});

	it("revoking an MCP key invalidates all sessions minted from it", async () => {
		const { token } = await createTestUser({ emailPrefix: "mcp-revoke" });

		const createKeyRes = await requestJson(app, "/users/me/mcp-keys", {
			method: "POST",
			headers: authHeader(token),
			body: JSON.stringify({ name: "Bot" }),
		});
		expect(createKeyRes.response.status).toBe(201);
		const createdKey = createKeyRes.body as { id: string; key: string };

		const firstExchange = await requestJson(app, "/auth/mcp", {
			method: "POST",
			body: JSON.stringify({ key: createdKey.key }),
		});
		expect(firstExchange.response.status).toBe(200);
		const firstMcpToken = (firstExchange.body as { token: string }).token;

		const secondExchange = await requestJson(app, "/auth/mcp", {
			method: "POST",
			body: JSON.stringify({ key: createdKey.key }),
		});
		expect(secondExchange.response.status).toBe(200);
		const secondMcpToken = (secondExchange.body as { token: string }).token;

		const revokeKey = await requestJson(
			app,
			`/users/me/mcp-keys/${createdKey.id}`,
			{
				method: "DELETE",
				headers: authHeader(token),
			},
		);
		expect(revokeKey.response.status).toBe(200);

		const firstAfter = await app.request("/users/me", {
			headers: authHeader(firstMcpToken),
		});
		expect(firstAfter.status).toBe(401);

		const secondAfter = await app.request("/users/me", {
			headers: authHeader(secondMcpToken),
		});
		expect(secondAfter.status).toBe(401);

		const exchangeAfterRevoke = await requestJson(app, "/auth/mcp", {
			method: "POST",
			body: JSON.stringify({ key: createdKey.key }),
		});
		expect(exchangeAfterRevoke.response.status).toBe(401);
	});

	it("password reset kills old browser sessions and auto-signs in a new session", async () => {
		const email = uniqueEmail("reset");
		const { token } = await createTestUser({ email, password: "Passw0rd!" });

		const createKeyRes = await requestJson(app, "/users/me/mcp-keys", {
			method: "POST",
			headers: authHeader(token),
			body: JSON.stringify({ name: "Reset-safe key" }),
		});
		expect(createKeyRes.response.status).toBe(201);
		const rawMcpKey = (createKeyRes.body as { key: string }).key;

		const mcpExchangeRes = await requestJson(app, "/auth/mcp", {
			method: "POST",
			body: JSON.stringify({ key: rawMcpKey }),
		});
		expect(mcpExchangeRes.response.status).toBe(200);
		const mcpToken = (mcpExchangeRes.body as { token: string }).token;

		// Drive the reset flow through the service to sidestep the email dispatch —
		// createVerificationToken is internal, so we drop a row directly.
		const user = await prisma.user.findUniqueOrThrow({ where: { email } });
		const resetToken = `test-reset-token-${Math.random().toString(36).slice(2)}`;
		await prisma.emailVerificationToken.create({
			data: {
				email,
				token: resetToken,
				purpose: EmailTokenPurpose.PASSWORD_RESET,
				userId: user.id,
				expiresAt: new Date(Date.now() + 60_000),
			},
		});

		const resetRes = await requestJson(app, "/auth/reset-password", {
			method: "POST",
			body: JSON.stringify({
				token: resetToken,
				password: "Passw0rd!Reset",
			}),
		});
		expect(resetRes.response.status).toBe(200);
		// Response should not leak a raw token in JSON.
		expect(resetRes.body).not.toHaveProperty("token");
		expect(resetRes.body).toHaveProperty("user");
		const resetSessionToken = readSessionTokenFromSetCookie(resetRes.response);

		// Old session is dead.
		const after = await app.request("/users/me", {
			headers: authHeader(token),
		});
		expect(after.status).toBe(401);

		// New session created by reset-password is immediately usable.
		const autoLoginAfterReset = await app.request("/users/me", {
			headers: authHeader(resetSessionToken),
		});
		expect(autoLoginAfterReset.status).toBe(200);

		// MCP sessions remain valid; password recovery does not revoke API-key access.
		const mcpAfter = await app.request("/users/me", {
			headers: authHeader(mcpToken),
		});
		expect(mcpAfter.status).toBe(200);
	});

	it("password reset recreates a missing local credential", async () => {
		const email = uniqueEmail("reset-missing-credential");
		await createTestUser({ email, password: "Passw0rd!" });
		const user = await prisma.user.findUniqueOrThrow({ where: { email } });
		await prisma.userCredential.delete({
			where: {
				userId_provider: {
					userId: user.id,
					provider: AuthProvider.LOCAL,
				},
			},
		});

		const resetToken = `test-reset-missing-credential-${Math.random().toString(36).slice(2)}`;
		await prisma.emailVerificationToken.create({
			data: {
				email,
				token: resetToken,
				purpose: EmailTokenPurpose.PASSWORD_RESET,
				userId: user.id,
				expiresAt: new Date(Date.now() + 60_000),
			},
		});

		const resetRes = await requestJson(app, "/auth/reset-password", {
			method: "POST",
			body: JSON.stringify({
				token: resetToken,
				password: "Passw0rd!Restored",
			}),
		});
		expect(resetRes.response.status).toBe(200);

		const loginRes = await requestJson(app, "/auth/login", {
			method: "POST",
			body: JSON.stringify({ email, password: "Passw0rd!Restored" }),
		});
		expect(loginRes.response.status).toBe(200);
	});

	it("password reset link can sign in without changing password or revoking browser sessions", async () => {
		const email = uniqueEmail("reset-sign-in");
		const first = await createTestUser({ email, password: "Passw0rd!" });

		const secondLogin = await requestJson(app, "/auth/login", {
			method: "POST",
			body: JSON.stringify({ email, password: "Passw0rd!" }),
		});
		expect(secondLogin.response.status).toBe(200);
		const secondToken = readSessionTokenFromSetCookie(secondLogin.response);

		const user = await prisma.user.findUniqueOrThrow({ where: { email } });
		const resetToken = `test-reset-login-token-${Math.random().toString(36).slice(2)}`;
		await prisma.emailVerificationToken.create({
			data: {
				email,
				token: resetToken,
				purpose: EmailTokenPurpose.PASSWORD_RESET,
				userId: user.id,
				expiresAt: new Date(Date.now() + 60_000),
			},
		});

		const signInRes = await requestJson(app, "/auth/reset-password/sign-in", {
			method: "POST",
			body: JSON.stringify({ token: resetToken }),
		});
		expect(signInRes.response.status).toBe(200);
		expect(signInRes.body).not.toHaveProperty("token");
		expect(signInRes.body).toHaveProperty("user");
		const resetLinkSessionToken = readSessionTokenFromSetCookie(
			signInRes.response,
		);

		const firstAfter = await app.request("/users/me", {
			headers: authHeader(first.token),
		});
		expect(firstAfter.status).toBe(200);

		const secondAfter = await app.request("/users/me", {
			headers: authHeader(secondToken),
		});
		expect(secondAfter.status).toBe(200);

		const resetLinkSessionAfter = await app.request("/users/me", {
			headers: authHeader(resetLinkSessionToken),
		});
		expect(resetLinkSessionAfter.status).toBe(200);

		const oldPasswordStillWorks = await requestJson(app, "/auth/login", {
			method: "POST",
			body: JSON.stringify({ email, password: "Passw0rd!" }),
		});
		expect(oldPasswordStillWorks.response.status).toBe(200);

		const reusedToken = await requestJson(app, "/auth/reset-password/sign-in", {
			method: "POST",
			body: JSON.stringify({ token: resetToken }),
		});
		expect(reusedToken.response.status).toBe(400);
	});

	it("GET /users/me/sessions lists sessions and marks the current one", async () => {
		const email = uniqueEmail("sessions-list");
		const first = await createTestUser({ email });

		const second = await requestJson(app, "/auth/login", {
			method: "POST",
			body: JSON.stringify({ email, password: "Passw0rd!" }),
		});
		expect(second.response.status).toBe(200);
		const secondToken = readSessionTokenFromSetCookie(second.response);

		const listRes = await app.request("/users/me/sessions", {
			headers: authHeader(first.token),
		});
		expect(listRes.status).toBe(200);
		const sessions = (await json(listRes)) as Array<{
			id: string;
			isCurrent: boolean;
			kind: string;
		}>;
		expect(sessions.length).toBe(2);
		const currentCount = sessions.filter((s) => s.isCurrent).length;
		expect(currentCount).toBe(1);
		expect(sessions.every((s) => s.kind === "BROWSER")).toBe(true);

		// Revoking everything-except-current leaves exactly one session.
		const revokeAll = await app.request("/users/me/sessions", {
			method: "DELETE",
			headers: authHeader(first.token),
		});
		expect(revokeAll.status).toBe(204);

		const listAfter = await app.request("/users/me/sessions", {
			headers: authHeader(first.token),
		});
		const sessionsAfter = (await json(listAfter)) as Array<{ id: string }>;
		expect(sessionsAfter.length).toBe(1);

		// The other token is now dead.
		const secondAfter = await app.request("/users/me", {
			headers: authHeader(secondToken),
		});
		expect(secondAfter.status).toBe(401);
	});

	it("DELETE /users/me/sessions/:id only revokes sessions owned by the caller", async () => {
		const alice = await createTestUser({ emailPrefix: "alice" });
		const bob = await createTestUser({ emailPrefix: "bob" });

		// Find Bob's session id.
		const bobList = await app.request("/users/me/sessions", {
			headers: authHeader(bob.token),
		});
		const bobSessions = (await json(bobList)) as Array<{ id: string }>;
		const bobSessionId = bobSessions[0]?.id;
		expect(bobSessionId).toBeDefined();

		// Alice tries to revoke Bob's session — should 404 (not 403, we don't
		// leak existence of other users' session IDs).
		const crossRes = await app.request(`/users/me/sessions/${bobSessionId}`, {
			method: "DELETE",
			headers: authHeader(alice.token),
		});
		expect(crossRes.status).toBe(404);

		// Bob's session still works.
		const bobStillOk = await app.request("/users/me", {
			headers: authHeader(bob.token),
		});
		expect(bobStillOk.status).toBe(200);
	});

	it("trusted sessions get a longer expiresAt than untrusted ones", async () => {
		const untrusted = await createTestUser({
			emailPrefix: "untrusted",
			password: "Passw0rd!",
		});
		const trusted = await createTestUser(
			{ emailPrefix: "trusted", password: "Passw0rd!" },
			{ trustDevice: true },
		);

		const rows = await prisma.session.findMany({
			where: {
				userId: { in: [untrusted.user.id, trusted.user.id] },
			},
			select: { userId: true, isTrusted: true, expiresAt: true },
		});
		const untrustedRow = rows.find((r) => r.userId === untrusted.user.id);
		const trustedRow = rows.find((r) => r.userId === trusted.user.id);

		expect(untrustedRow?.isTrusted).toBe(false);
		expect(trustedRow?.isTrusted).toBe(true);
		// Trusted TTL (30d) should outstrip untrusted TTL (7d) by at least 20 days.
		const trustedMs = trustedRow?.expiresAt?.getTime() ?? 0;
		const untrustedMs = untrustedRow?.expiresAt?.getTime() ?? 0;
		expect(trustedMs - untrustedMs).toBeGreaterThan(20 * 24 * 3600 * 1000);
	});
});
