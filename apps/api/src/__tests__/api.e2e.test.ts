import { EmailTokenPurpose, prisma } from "@taskflow/db";
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
		expect(response.headers.get("access-control-allow-headers")).toContain(
			"Authorization",
		);
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
			studentId: "A001",
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
			studentId: "A002",
		});

		const memberToken = registerMember.token;
		const memberUserId = registerMember.user.id;

		const registerOutsider = await createTestUser({
			email: outsiderEmail,
			password: "Passw0rd!",
			nickname: "Outsider",
			schoolId: schoolBId,
			studentId: "B001",
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

		const patchMe = await requestJson(app, "/users/me", {
			method: "PATCH",
			headers: authHeader(ownerToken),
			body: JSON.stringify({
				nickname: "Owner Updated",
				schoolId: schoolAId,
				studentId: "A099",
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

		const avatarForm = new FormData();
		avatarForm.append(
			"file",
			new File([Buffer.from("avatar-bytes")], "avatar.txt", {
				type: "text/plain",
			}),
		);
		const avatarResponse = await app.request("/users/me/avatar", {
			method: "POST",
			headers: authHeader(ownerToken),
			body: avatarForm,
		});
		expect(avatarResponse.status).toBe(200);
		const avatarBody = (await json(avatarResponse)) as { fileKey: string };

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

		const classPatch = await requestJson(app, `/classes/${classId}`, {
			method: "PATCH",
			headers: authHeader(ownerToken),
			body: JSON.stringify({ description: "Updated description" }),
		});
		expect(classPatch.response.status).toBe(200);

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
			studentId: "A333",
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

		const draftAttachmentForm = new FormData();
		draftAttachmentForm.append(
			"files",
			new File([Buffer.from("draft-only-attachment")], "draft-only.txt", {
				type: "text/plain",
			}),
		);
		const draftAttachmentRes = await app.request(
			`/tasks/${draftTaskWithAttachmentId}/attachments`,
			{
				method: "POST",
				headers: authHeader(ownerToken),
				body: draftAttachmentForm,
			},
		);
		expect(draftAttachmentRes.status).toBe(201);

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

		const taskAttachmentForm = new FormData();
		taskAttachmentForm.append(
			"files",
			new File([Buffer.from("task-file")], "task.txt", { type: "text/plain" }),
		);
		const taskAttachmentRes = await app.request(
			`/tasks/${taskId}/attachments`,
			{
				method: "POST",
				headers: authHeader(ownerToken),
				body: taskAttachmentForm,
			},
		);
		expect(taskAttachmentRes.status).toBe(201);
		const taskAttachmentBody = (await json(taskAttachmentRes)) as Array<{
			id: string;
			fileKey: string;
			isVisible: boolean;
		}>;
		expect(taskAttachmentBody[0]?.isVisible).toBe(true);

		const hiddenTaskAttachmentForm = new FormData();
		hiddenTaskAttachmentForm.append(
			"files",
			new File([Buffer.from("task-hidden-file")], "task-hidden.txt", {
				type: "text/plain",
			}),
		);
		hiddenTaskAttachmentForm.append("isVisible", "false");
		const hiddenTaskAttachmentRes = await app.request(
			`/tasks/${taskId}/attachments`,
			{
				method: "POST",
				headers: authHeader(ownerToken),
				body: hiddenTaskAttachmentForm,
			},
		);
		expect(hiddenTaskAttachmentRes.status).toBe(201);
		const hiddenTaskAttachmentBody = (await json(
			hiddenTaskAttachmentRes,
		)) as Array<{
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

		const submissionForm = new FormData();
		submissionForm.append(
			"files",
			new File([Buffer.from("submission-file")], "submission.txt", {
				type: "text/plain",
			}),
		);
		const submitRes = await app.request(
			`/tasks/${taskId}/submissions/me/attachments`,
			{
				method: "POST",
				headers: authHeader(memberToken),
				body: submissionForm,
			},
		);
		expect(submitRes.status).toBe(201);
		const submitBody = (await json(submitRes)) as Array<{ fileKey: string }>;
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

		const fileAvatarRes = await app.request(
			`/files/${encodeURIComponent(avatarBody.fileKey)}`,
			{
				headers: authHeader(ownerToken),
			},
		);
		expect(fileAvatarRes.status).toBe(302);

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
		const secondToken = (secondLogin.body as { token: string }).token;
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

	it("password reset kills every browser session and does not return a new token", async () => {
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
		const resetToken =
			"test-reset-token-" + Math.random().toString(36).slice(2);
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
		// Response must not leak a new token — user is expected to log in again.
		expect(resetRes.body).not.toHaveProperty("token");
		expect(resetRes.body).not.toHaveProperty("user");

		// Old session is dead.
		const after = await app.request("/users/me", {
			headers: authHeader(token),
		});
		expect(after.status).toBe(401);

		// But the new password works.
		const newLogin = await requestJson(app, "/auth/login", {
			method: "POST",
			body: JSON.stringify({ email, password: "Passw0rd!Reset" }),
		});
		expect(newLogin.response.status).toBe(200);

		// MCP sessions remain valid; password recovery does not revoke API-key access.
		const mcpAfter = await app.request("/users/me", {
			headers: authHeader(mcpToken),
		});
		expect(mcpAfter.status).toBe(200);
	});

	it("GET /users/me/sessions lists sessions and marks the current one", async () => {
		const email = uniqueEmail("sessions-list");
		const first = await createTestUser({ email });

		const second = await requestJson(app, "/auth/login", {
			method: "POST",
			body: JSON.stringify({ email, password: "Passw0rd!" }),
		});
		expect(second.response.status).toBe(200);
		const secondToken = (second.body as { token: string }).token;

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
		const trustedMs = trustedRow!.expiresAt!.getTime();
		const untrustedMs = untrustedRow!.expiresAt!.getTime();
		expect(trustedMs - untrustedMs).toBeGreaterThan(20 * 24 * 3600 * 1000);
	});
});
