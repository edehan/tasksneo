import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@taskflow/db';

import { createApp } from '../app.js';
import { json, requestJson, resetDatabase, uniqueEmail } from './test-helpers.js';

const app = createApp({ startWorker: false });

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

describe('TaskFlow API e2e', () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns 401 for protected endpoints without token', async () => {
    const protectedEndpoints: Array<{ method: string; path: string }> = [
      { method: 'GET', path: '/users/me' },
      { method: 'GET', path: '/classes' },
      { method: 'POST', path: '/classes/join' },
      { method: 'GET', path: '/tasks/00000000-0000-0000-0000-000000000000' },
      { method: 'GET', path: '/files/any' },
    ];

    for (const endpoint of protectedEndpoints) {
      const response = await app.request(endpoint.path, { method: endpoint.method });
      expect(response.status).toBe(401);
    }
  });

  it('covers all implemented endpoints success and key failures', async () => {
    const adminToken = process.env.ADMIN_TOKEN ?? 'test-admin-token';

    const configPatch = await requestJson(app, '/admin/config', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        'app.title': 'TaskFlow Test',
        'auth.registration_open': 'true',
      }),
    });

    expect(configPatch.response.status).toBe(200);

    const configGet = await app.request('/admin/config', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(configGet.status).toBe(200);

    const sendTestEmailWithoutSmtp = await requestJson(app, '/admin/config/test-email', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ to: 'smtp-test@example.com' }),
    });
    expect(sendTestEmailWithoutSmtp.response.status).toBe(400);
    expect((sendTestEmailWithoutSmtp.body as { code: string }).code).toBe('SMTP_NOT_CONFIGURED');

    const schoolARes = await requestJson(app, '/admin/schools', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `SchoolA-${Date.now()}` }),
    });
    expect(schoolARes.response.status).toBe(201);

    const schoolBRes = await requestJson(app, '/admin/schools', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `SchoolB-${Date.now()}` }),
    });
    expect(schoolBRes.response.status).toBe(201);

    const schoolAId = (schoolARes.body as { id: string }).id;
    const schoolBId = (schoolBRes.body as { id: string }).id;

    const publicSchools = await app.request('/schools');
    expect(publicSchools.status).toBe(200);

    const ownerEmail = uniqueEmail('owner');
    const memberEmail = uniqueEmail('member');
    const outsiderEmail = uniqueEmail('outsider');
    const tempEmail = uniqueEmail('temp');

    const registerOwner = await requestJson(app, '/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: ownerEmail,
        password: 'Passw0rd!',
        nickname: 'Owner',
        schoolId: schoolAId,
        studentId: 'A001',
      }),
    });
    expect(registerOwner.response.status).toBe(201);

    const ownerToken = (registerOwner.body as { token: string }).token;
    const ownerUserId = (registerOwner.body as { user: { id: string } }).user.id;

    const registerMember = await requestJson(app, '/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: memberEmail,
        password: 'Passw0rd!',
        nickname: 'Member',
        schoolId: schoolAId,
        studentId: 'A002',
      }),
    });
    expect(registerMember.response.status).toBe(201);

    const memberToken = (registerMember.body as { token: string }).token;
    const memberUserId = (registerMember.body as { user: { id: string } }).user.id;

    const registerOutsider = await requestJson(app, '/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: outsiderEmail,
        password: 'Passw0rd!',
        nickname: 'Outsider',
        schoolId: schoolBId,
        studentId: 'B001',
      }),
    });
    expect(registerOutsider.response.status).toBe(201);

    const outsiderToken = (registerOutsider.body as { token: string }).token;
    const outsiderUserId = (registerOutsider.body as { user: { id: string } }).user.id;

    const registerTemp = await requestJson(app, '/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: tempEmail,
        password: 'Passw0rd!',
      }),
    });
    expect(registerTemp.response.status).toBe(201);

    const tempToken = (registerTemp.body as { token: string }).token;

    const loginOwner = await requestJson(app, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: ownerEmail, password: 'Passw0rd!' }),
    });
    expect(loginOwner.response.status).toBe(200);

    const meOwner = await app.request('/users/me', { headers: authHeader(ownerToken) });
    expect(meOwner.status).toBe(200);

    const patchMe = await requestJson(app, '/users/me', {
      method: 'PATCH',
      headers: authHeader(ownerToken),
      body: JSON.stringify({ nickname: 'Owner Updated', schoolId: schoolAId, studentId: 'A099' }),
    });
    expect(patchMe.response.status).toBe(200);

    const patchPassword = await requestJson(app, '/users/me/password', {
      method: 'PATCH',
      headers: authHeader(ownerToken),
      body: JSON.stringify({ currentPassword: 'Passw0rd!', newPassword: 'Passw0rd!2' }),
    });
    expect(patchPassword.response.status).toBe(204);

    const prefsGet = await app.request('/users/me/notification-prefs', { headers: authHeader(ownerToken) });
    expect(prefsGet.status).toBe(200);

    const prefsPost = await requestJson(app, '/users/me/notification-prefs', {
      method: 'POST',
      headers: authHeader(ownerToken),
      body: JSON.stringify({ channel: 'EMAIL', address: ownerEmail, isEnabled: true }),
    });
    expect(prefsPost.response.status).toBe(200);

    const avatarForm = new FormData();
    avatarForm.append('file', new File([Buffer.from('avatar-bytes')], 'avatar.txt', { type: 'text/plain' }));
    const avatarResponse = await app.request('/users/me/avatar', {
      method: 'POST',
      headers: authHeader(ownerToken),
      body: avatarForm,
    });
    expect(avatarResponse.status).toBe(200);
    const avatarBody = (await json(avatarResponse)) as { fileKey: string };

    const createClassRes = await requestJson(app, '/classes', {
      method: 'POST',
      headers: authHeader(ownerToken),
      body: JSON.stringify({
        name: 'Physics 101',
        description: 'Week 1',
        color: '#0f766e',
        schoolId: schoolAId,
      }),
    });
    expect(createClassRes.response.status).toBe(201);

    const classId = (createClassRes.body as { id: string }).id;
    const inviteCode = (createClassRes.body as { inviteCode: string }).inviteCode;

    const classesList = await app.request('/classes', { headers: authHeader(ownerToken) });
    expect(classesList.status).toBe(200);

    const refreshInvite = await requestJson(app, `/classes/${classId}/invite-code`, {
      method: 'POST',
      headers: authHeader(ownerToken),
      body: JSON.stringify({}),
    });
    expect(refreshInvite.response.status).toBe(200);
    const activeInviteCode = (refreshInvite.body as { inviteCode: string }).inviteCode;

    const outsiderJoinFail = await requestJson(app, '/classes/join', {
      method: 'POST',
      headers: authHeader(outsiderToken),
      body: JSON.stringify({ inviteCode: activeInviteCode }),
    });
    expect(outsiderJoinFail.response.status).toBe(403);

    const memberJoin = await requestJson(app, '/classes/join', {
      method: 'POST',
      headers: authHeader(memberToken),
      body: JSON.stringify({ inviteCode: activeInviteCode }),
    });
    expect(memberJoin.response.status).toBe(200);

    const duplicateJoin = await requestJson(app, '/classes/join', {
      method: 'POST',
      headers: authHeader(memberToken),
      body: JSON.stringify({ inviteCode: activeInviteCode }),
    });
    expect(duplicateJoin.response.status).toBe(409);

    const classDetail = await app.request(`/classes/${classId}`, { headers: authHeader(memberToken) });
    expect(classDetail.status).toBe(200);

    const classPatch = await requestJson(app, `/classes/${classId}`, {
      method: 'PATCH',
      headers: authHeader(ownerToken),
      body: JSON.stringify({ description: 'Updated description' }),
    });
    expect(classPatch.response.status).toBe(200);

    const membersList = await app.request(`/classes/${classId}/members`, { headers: authHeader(ownerToken) });
    expect(membersList.status).toBe(200);

    const memberPromote = await requestJson(app, `/classes/${classId}/members/${memberUserId}`, {
      method: 'PATCH',
      headers: authHeader(ownerToken),
      body: JSON.stringify({ role: 'ADMIN' }),
    });
    expect(memberPromote.response.status).toBe(200);

    const memberDemote = await requestJson(app, `/classes/${classId}/members/${memberUserId}`, {
      method: 'PATCH',
      headers: authHeader(ownerToken),
      body: JSON.stringify({ role: 'MEMBER' }),
    });
    expect(memberDemote.response.status).toBe(200);

    const thirdEmail = uniqueEmail('third');
    const thirdRegister = await requestJson(app, '/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: thirdEmail,
        password: 'Passw0rd!',
        schoolId: schoolAId,
        studentId: 'A333',
      }),
    });
    const thirdToken = (thirdRegister.body as { token: string }).token;
    const thirdUserId = (thirdRegister.body as { user: { id: string } }).user.id;

    await requestJson(app, '/classes/join', {
      method: 'POST',
      headers: authHeader(thirdToken),
      body: JSON.stringify({ inviteCode: activeInviteCode }),
    });

    const ownerRemoveThird = await requestJson(app, `/classes/${classId}/members/${thirdUserId}`, {
      method: 'DELETE',
      headers: authHeader(ownerToken),
    });
    expect(ownerRemoveThird.response.status).toBe(204);

    const createTaskRes = await requestJson(app, `/classes/${classId}/tasks`, {
      method: 'POST',
      headers: authHeader(ownerToken),
      body: JSON.stringify({
        title: 'Task 1',
        description: 'Solve chapter 1',
        dueAt: new Date(Date.now() + 86_400_000).toISOString(),
        allowLateSubmission: true,
      }),
    });
    expect(createTaskRes.response.status).toBe(201);

    const taskId = (createTaskRes.body as { id: string }).id;

    const listTasks = await app.request(`/classes/${classId}/tasks`, { headers: authHeader(memberToken) });
    expect(listTasks.status).toBe(200);

    const parseTask = await requestJson(app, '/tasks/parse', {
      method: 'POST',
      headers: authHeader(ownerToken),
      body: JSON.stringify({ text: 'Math homework due tomorrow' }),
    });
    expect(parseTask.response.status).toBe(200);

    const getTask = await app.request(`/tasks/${taskId}`, { headers: authHeader(ownerToken) });
    expect(getTask.status).toBe(200);

    const patchTask = await requestJson(app, `/tasks/${taskId}`, {
      method: 'PATCH',
      headers: authHeader(ownerToken),
      body: JSON.stringify({ title: 'Task 1 updated', blockedBy: [] }),
    });
    expect(patchTask.response.status).toBe(200);

    const taskView = await requestJson(app, `/tasks/${taskId}/view`, {
      method: 'POST',
      headers: authHeader(memberToken),
      body: JSON.stringify({}),
    });
    expect(taskView.response.status).toBe(204);

    const taskState = await requestJson(app, `/tasks/${taskId}/state`, {
      method: 'PATCH',
      headers: authHeader(memberToken),
      body: JSON.stringify({ tags: ['urgent'], sortOrder: 1 }),
    });
    expect(taskState.response.status).toBe(200);

    const taskAttachmentForm = new FormData();
    taskAttachmentForm.append('files', new File([Buffer.from('task-file')], 'task.txt', { type: 'text/plain' }));
    const taskAttachmentRes = await app.request(`/tasks/${taskId}/attachments`, {
      method: 'POST',
      headers: authHeader(ownerToken),
      body: taskAttachmentForm,
    });
    expect(taskAttachmentRes.status).toBe(201);
    const taskAttachmentBody = (await json(taskAttachmentRes)) as Array<{ fileKey: string }>;

    const submissionForm = new FormData();
    submissionForm.append('files', new File([Buffer.from('submission-file')], 'submission.txt', { type: 'text/plain' }));
    const submitRes = await app.request(`/tasks/${taskId}/submissions/me/attachments`, {
      method: 'POST',
      headers: authHeader(memberToken),
      body: submissionForm,
    });
    expect(submitRes.status).toBe(200);
    const submitBody = (await json(submitRes)) as { id: string; attachments: Array<{ fileKey: string }> };
    const submissionId = submitBody.id;

    const mySubmissionRes = await app.request(`/tasks/${taskId}/submissions/me`, { headers: authHeader(memberToken) });
    expect(mySubmissionRes.status).toBe(200);

    const allSubmissions = await app.request(`/tasks/${taskId}/submissions`, { headers: authHeader(ownerToken) });
    expect(allSubmissions.status).toBe(200);

    const gradeRes = await requestJson(app, `/tasks/${taskId}/submissions/${submissionId}/grade`, {
      method: 'PATCH',
      headers: authHeader(ownerToken),
      body: JSON.stringify({ score: '95.50', reviewNote: 'Good work' }),
    });
    expect(gradeRes.response.status).toBe(200);

    const exportCsv = await app.request(`/tasks/${taskId}/submissions/export`, { headers: authHeader(ownerToken) });
    expect(exportCsv.status).toBe(200);
    const csvText = await exportCsv.text();
    expect(csvText.includes('任务名称')).toBe(true);

    const renameRes = await requestJson(app, `/tasks/${taskId}/submissions/rename`, {
      method: 'POST',
      headers: authHeader(ownerToken),
      body: JSON.stringify({}),
    });
    expect(renameRes.response.status).toBe(204);

    const fileTaskRes = await app.request(`/files/${encodeURIComponent(taskAttachmentBody[0].fileKey)}`, {
      headers: authHeader(memberToken),
    });
    expect(fileTaskRes.status).toBe(302);

    const fileSubmissionRes = await app.request(`/files/${encodeURIComponent(submitBody.attachments[0].fileKey)}`, {
      headers: authHeader(ownerToken),
    });
    expect(fileSubmissionRes.status).toBe(302);

    const fileAvatarRes = await app.request(`/files/${encodeURIComponent(avatarBody.fileKey)}`, {
      headers: authHeader(ownerToken),
    });
    expect(fileAvatarRes.status).toBe(302);

    const transferRes = await requestJson(app, `/classes/${classId}/transfer`, {
      method: 'POST',
      headers: authHeader(ownerToken),
      body: JSON.stringify({ newOwnerId: memberUserId }),
    });
    expect(transferRes.response.status).toBe(200);

    const deleteClassRes = await requestJson(app, `/classes/${classId}`, {
      method: 'DELETE',
      headers: authHeader(memberToken),
      body: JSON.stringify({}),
    });
    expect(deleteClassRes.response.status).toBe(204);

    const orphanTask = await prisma.task.findUnique({ where: { id: taskId } });
    expect(orphanTask).not.toBeNull();
    expect(orphanTask?.classId).toBeNull();

    const orphanSubmission = await prisma.submission.findUnique({ where: { id: submissionId } });
    expect(orphanSubmission).not.toBeNull();

    const deleteTaskRes = await requestJson(app, `/tasks/${taskId}`, {
      method: 'DELETE',
      headers: authHeader(memberToken),
      body: JSON.stringify({}),
    });
    expect(deleteTaskRes.response.status).toBe(403);

    const listAdminUsersRes = await app.request('/admin/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(listAdminUsersRes.status).toBe(200);

    const disableUserRes = await requestJson(app, `/admin/users/${outsiderUserId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ isActive: false }),
    });
    expect(disableUserRes.response.status).toBe(200);

    const disabledLogin = await requestJson(app, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: outsiderEmail, password: 'Passw0rd!' }),
    });
    expect(disabledLogin.response.status).toBe(403);

    const reenableUserRes = await requestJson(app, `/admin/users/${outsiderUserId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ isActive: true, password: 'Passw0rd!' }),
    });
    expect(reenableUserRes.response.status).toBe(200);

    const deleteOutsider = await requestJson(app, `/admin/users/${outsiderUserId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({}),
    });
    expect(deleteOutsider.response.status).toBe(204);

    const listSchoolsAdmin = await app.request('/admin/schools', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(listSchoolsAdmin.status).toBe(200);

    const deleteSchool = await requestJson(app, `/admin/schools/${schoolBId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({}),
    });
    expect(deleteSchool.response.status).toBe(204);

    const deleteMyAccountRes = await requestJson(app, '/users/me/delete', {
      method: 'POST',
      headers: authHeader(tempToken),
      body: JSON.stringify({}),
    });
    expect(deleteMyAccountRes.response.status).toBe(204);

    const oldInviteJoin = await requestJson(app, '/classes/join', {
      method: 'POST',
      headers: authHeader(memberToken),
      body: JSON.stringify({ inviteCode }),
    });
    expect([404, 409]).toContain(oldInviteJoin.response.status);

    expect(ownerUserId).not.toBe(memberUserId);
  });
});
