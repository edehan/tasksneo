// ─── Error Types ─────────────────────────────────────────────────────────────

export interface ApiErrorShape {
  error: string;
  code: string;
}

export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// ─── Domain Types ────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  nickname: string | null;
  schoolId: string | null;
  schoolName: string | null;
  studentId: string | null;
  timezone: string;
  isActive: boolean;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export interface School {
  id: string;
  name: string;
  createdAt: string;
}

export interface ClassSummary {
  id: string;
  name: string;
  description: string | null;
  color: string;
  isPersonal: boolean;
  ownerId: string;
  schoolId: string | null;
  inviteCode: string | null;
  myRole: "OWNER" | "ADMIN" | "MEMBER";
  memberCount: number;
  createdAt: string;
}

export interface ClassMember {
  userId: string;
  email: string;
  nickname: string | null;
  role: "OWNER" | "ADMIN" | "MEMBER";
  joinedAt: string;
}

export interface TaskUserState {
  viewedAt: string | null;
  tags: string[];
  sortOrder: number;
  submittedAt: string | null;
}

export interface TaskSummary {
  id: string;
  classId: string;
  className: string;
  title: string;
  sourceText: string | null;
  startAt: string | null;
  dueAt: string | null;
  allowLateSubmission: boolean;
  blockedBy: string[];
  isPublished: boolean;
  publishedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  userState: TaskUserState | null;
  submittedCount: number;
  memberCount: number;
}

export interface AttachmentMeta {
  id: string;
  fileKey: string;
  originalName: string;
  renamedFile: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  url?: string;
  createdAt: string;
}

export interface TaskStats {
  memberCount: number;
  viewedCount: number;
  submittedCount: number;
}

export interface TaskDetail extends TaskSummary {
  description: string | null;
  attachments: AttachmentMeta[];
  stats: TaskStats | null;
}

export interface ParseTimeOption {
  startAt: string | null;
  dueAt: string | null;
}

export interface ParseTaskResponse {
  title: string | null;
  timeOptions: ParseTimeOption[];
  allowLateSubmission: boolean | null;
  description: string | null;
}

export interface ParseDraftTaskResponse extends ParseTaskResponse {
  markdownCached: boolean;
}

export interface SubmissionSummary {
  id: string;
  taskId: string;
  userId: string;
  firstSubmittedAt: string;
  lastUpdatedAt: string;
  content: string | null;
  score: string | null;
  reviewerId: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}

export interface SubmissionDetail extends SubmissionSummary {
  attachments: AttachmentMeta[];
}

/** Row returned by GET /tasks/:taskId/submissions (admin list) */
export interface SubmissionListRow {
  userId: string;
  nickname: string | null;
  email: string;
  schoolName: string | null;
  studentId: string | null;
  role: "OWNER" | "ADMIN" | "MEMBER";
  submitted: boolean;
  submission: SubmissionSummary | null;
  attachments: AttachmentMeta[];
}

export interface NotificationPref {
  id: string;
  channel: "EMAIL" | "WEBHOOK" | "TELEGRAM";
  address: string;
  isEnabled: boolean;
}

export interface NotificationItem {
  id: string;
  type: "TASK_PUBLISHED" | "TASK_DUE_REMINDER";
  taskId: string | null;
  classId: string | null;
  taskTitle: string;
  className: string;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  nextCursor: string | null;
  unreadCount: number;
}

// ─── Admin Types (kept for admin panel) ──────────────────────────────────────

export interface AdminSchool {
  id: string;
  name: string;
}

export interface AdminUpdateUserInput {
  isActive?: boolean;
  password?: string;
}

// ─── Core Request Function ───────────────────────────────────────────────────

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(init.headers ?? {});

  if (
    !headers.has("Content-Type") &&
    init.body &&
    !(init.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    let errorCode = "HTTP_ERROR";

    try {
      const json = (await response.json()) as Partial<ApiErrorShape>;
      if (json.error) {
        errorMessage = json.error;
      }
      if (json.code) {
        errorCode = json.code;
      }
    } catch {
      // Keep fallback message when response body is not JSON.
    }

    throw new ApiError(errorMessage, errorCode, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function register(email: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function verifyToken(
  token: string,
  purpose: "REGISTRATION" | "PASSWORD_RESET",
): Promise<{ valid: boolean; email: string }> {
  return apiRequest<{ valid: boolean; email: string }>(
    `/auth/verify-token?token=${encodeURIComponent(token)}&purpose=${purpose}`,
  );
}

export async function completeRegistration(input: {
  token: string;
  password: string;
  nickname?: string;
  schoolId?: string | null;
  studentId?: string | null;
  timezone?: string;
}): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/register/complete", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function requestPasswordReset(
  email: string,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export async function requestEmailChange(
  authToken: string,
  newEmail: string,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(
    "/users/me/email/change",
    { method: "POST", body: JSON.stringify({ email: newEmail }) },
    authToken,
  );
}

export async function confirmEmailChange(
  authToken: string,
  verificationToken: string,
): Promise<UserProfile> {
  return apiRequest<UserProfile>(
    "/users/me/email/confirm",
    { method: "POST", body: JSON.stringify({ token: verificationToken }) },
    authToken,
  );
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function getMe(token: string): Promise<UserProfile> {
  return apiRequest<UserProfile>("/users/me", {}, token);
}

export async function updateProfile(
  token: string,
  input: {
    nickname?: string | null;
    schoolId?: string | null;
    studentId?: string | null;
    timezone?: string;
  },
): Promise<UserProfile> {
  return apiRequest<UserProfile>(
    "/users/me",
    { method: "PATCH", body: JSON.stringify(input) },
    token,
  );
}

export async function updatePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  return apiRequest<void>(
    "/users/me/password",
    {
      method: "PATCH",
      body: JSON.stringify({ currentPassword, newPassword }),
    },
    token,
  );
}

export async function getNotificationPrefs(
  token: string,
): Promise<NotificationPref[]> {
  return apiRequest<NotificationPref[]>(
    "/users/me/notification-prefs",
    {},
    token,
  );
}

export async function upsertNotificationPref(
  token: string,
  input: {
    channel: "EMAIL" | "WEBHOOK" | "TELEGRAM";
    address: string;
    isEnabled?: boolean;
  },
): Promise<NotificationPref> {
  return apiRequest<NotificationPref>(
    "/users/me/notification-prefs",
    { method: "PUT", body: JSON.stringify(input) },
    token,
  );
}

export async function listMyNotifications(
  token: string,
  params?: { limit?: number; cursor?: string; unreadOnly?: boolean },
): Promise<NotificationListResponse> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.cursor) query.set("cursor", params.cursor);
  if (params?.unreadOnly) query.set("unreadOnly", "true");
  const qs = query.toString();
  return apiRequest<NotificationListResponse>(
    `/users/me/notifications${qs ? `?${qs}` : ""}`,
    {},
    token,
  );
}

export async function markNotificationRead(
  token: string,
  id: string,
): Promise<void> {
  return apiRequest<void>(
    `/users/me/notifications/${id}/read`,
    { method: "PATCH" },
    token,
  );
}

export async function markAllNotificationsRead(
  token: string,
): Promise<void> {
  return apiRequest<void>(
    "/users/me/notifications/read-all",
    { method: "POST" },
    token,
  );
}

export async function getUnreadNotificationCount(
  token: string,
): Promise<{ unreadCount: number }> {
  return apiRequest<{ unreadCount: number }>(
    "/users/me/notifications/unread-count",
    {},
    token,
  );
}

export async function deleteAccount(token: string): Promise<void> {
  return apiRequest<void>("/users/me/delete", { method: "POST" }, token);
}

export async function uploadAvatar(
  token: string,
  file: File,
): Promise<AttachmentMeta> {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest<AttachmentMeta>(
    "/users/me/avatar",
    { method: "POST", body: formData },
    token,
  );
}

// ─── Schools ─────────────────────────────────────────────────────────────────

export async function listSchools(): Promise<School[]> {
  return apiRequest<School[]>("/schools");
}

// ─── Classes ─────────────────────────────────────────────────────────────────

export async function listClasses(token: string): Promise<ClassSummary[]> {
  return apiRequest<ClassSummary[]>("/classes", {}, token);
}

export async function createClass(
  token: string,
  input: {
    name: string;
    description?: string | null;
    color?: string;
    schoolId?: string | null;
  },
): Promise<ClassSummary> {
  return apiRequest<ClassSummary>(
    "/classes",
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}

export async function joinClass(
  token: string,
  inviteCode: string,
): Promise<ClassSummary> {
  return apiRequest<ClassSummary>(
    "/classes/join",
    { method: "POST", body: JSON.stringify({ inviteCode }) },
    token,
  );
}

export async function getClass(
  token: string,
  classId: string,
): Promise<ClassSummary> {
  return apiRequest<ClassSummary>(`/classes/${classId}`, {}, token);
}

export async function updateClass(
  token: string,
  classId: string,
  input: { name?: string; description?: string | null; color?: string },
): Promise<ClassSummary> {
  return apiRequest<ClassSummary>(
    `/classes/${classId}`,
    { method: "PATCH", body: JSON.stringify(input) },
    token,
  );
}

export async function deleteClass(
  token: string,
  classId: string,
): Promise<void> {
  return apiRequest<void>(`/classes/${classId}`, { method: "DELETE" }, token);
}

export async function refreshInviteCode(
  token: string,
  classId: string,
): Promise<{ inviteCode: string }> {
  return apiRequest<{ inviteCode: string }>(
    `/classes/${classId}/invite-code`,
    { method: "POST" },
    token,
  );
}

export async function transferOwnership(
  token: string,
  classId: string,
  newOwnerId: string,
): Promise<ClassSummary> {
  return apiRequest<ClassSummary>(
    `/classes/${classId}/transfer`,
    { method: "POST", body: JSON.stringify({ newOwnerId }) },
    token,
  );
}

export async function listMembers(
  token: string,
  classId: string,
): Promise<ClassMember[]> {
  return apiRequest<ClassMember[]>(`/classes/${classId}/members`, {}, token);
}

export async function updateMemberRole(
  token: string,
  classId: string,
  userId: string,
  role: "ADMIN" | "MEMBER",
): Promise<ClassMember> {
  return apiRequest<ClassMember>(
    `/classes/${classId}/members/${userId}`,
    { method: "PATCH", body: JSON.stringify({ role }) },
    token,
  );
}

export async function removeMember(
  token: string,
  classId: string,
  userId: string,
): Promise<void> {
  return apiRequest<void>(
    `/classes/${classId}/members/${userId}`,
    { method: "DELETE" },
    token,
  );
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export async function listClassTasks(
  token: string,
  classId: string,
): Promise<TaskSummary[]> {
  return apiRequest<TaskSummary[]>(`/classes/${classId}/tasks`, {}, token);
}

interface DraftWithAttachments extends TaskSummary {
  attachments: AttachmentMeta[];
}

export async function getMyClassDraft(
  token: string,
  classId: string,
): Promise<DraftWithAttachments | null> {
  const res = await apiRequest<{ draft: DraftWithAttachments | null }>(
    `/classes/${classId}/tasks/drafts/mine`,
    {},
    token,
  );
  return res.draft;
}

export interface MyTaskSummary extends TaskSummary {
  classColor: string | null;
}

export async function listMyTasks(
  token: string,
): Promise<MyTaskSummary[]> {
  return apiRequest<MyTaskSummary[]>("/tasks/mine", {}, token);
}

export async function createTask(
  token: string,
  classId: string,
  input: {
    title: string;
    description?: string | null;
    startAt?: string | null;
    dueAt?: string | null;
    allowLateSubmission?: boolean;
    blockedBy?: string[];
  },
): Promise<TaskDetail> {
  return apiRequest<TaskDetail>(
    `/classes/${classId}/tasks`,
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}

export async function createTaskDraft(
  token: string,
  classId: string,
  input: {
    title?: string;
    description?: string | null;
    sourceText?: string | null;
    startAt?: string | null;
    dueAt?: string | null;
    allowLateSubmission?: boolean;
    blockedBy?: string[];
  } = {},
): Promise<TaskSummary> {
  return apiRequest<TaskSummary>(
    `/classes/${classId}/tasks/drafts`,
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}

export async function parseTask(
  token: string,
  text: string,
): Promise<ParseTaskResponse> {
  return apiRequest<ParseTaskResponse>(
    "/tasks/parse",
    { method: "POST", body: JSON.stringify({ text }) },
    token,
  );
}

export async function parseTaskDraft(
  token: string,
  taskId: string,
  text?: string,
): Promise<ParseDraftTaskResponse> {
  return apiRequest<ParseDraftTaskResponse>(
    `/tasks/${taskId}/parse`,
    {
      method: "POST",
      body: JSON.stringify(text ? { text } : {}),
    },
    token,
  );
}

export async function getTaskDraftMarkdown(
  token: string,
  taskId: string,
): Promise<{ markdown: string | null }> {
  return apiRequest<{ markdown: string | null }>(
    `/tasks/${taskId}/draft-markdown`,
    {},
    token,
  );
}

export async function getTask(
  token: string,
  taskId: string,
): Promise<TaskDetail> {
  return apiRequest<TaskDetail>(`/tasks/${taskId}`, {}, token);
}

export async function updateTask(
  token: string,
  taskId: string,
  input: {
    title?: string;
    description?: string | null;
    sourceText?: string | null;
    startAt?: string | null;
    dueAt?: string | null;
    allowLateSubmission?: boolean;
    blockedBy?: string[];
  },
): Promise<TaskDetail> {
  return apiRequest<TaskDetail>(
    `/tasks/${taskId}`,
    { method: "PATCH", body: JSON.stringify(input) },
    token,
  );
}

export async function publishTaskDraft(
  token: string,
  taskId: string,
  input: {
    title?: string;
    description?: string | null;
    sourceText?: string | null;
    startAt?: string | null;
    dueAt?: string | null;
    allowLateSubmission?: boolean;
    blockedBy?: string[];
  },
): Promise<TaskSummary> {
  return apiRequest<TaskSummary>(
    `/tasks/${taskId}/publish`,
    { method: "POST", body: JSON.stringify(input) },
    token,
  );
}

export async function deleteTask(token: string, taskId: string): Promise<void> {
  return apiRequest<void>(`/tasks/${taskId}`, { method: "DELETE" }, token);
}

export async function markTaskViewed(
  token: string,
  taskId: string,
): Promise<void> {
  return apiRequest<void>(`/tasks/${taskId}/view`, { method: "POST" }, token);
}

export async function updateTaskState(
  token: string,
  taskId: string,
  input: { tags?: string[]; sortOrder?: number },
): Promise<TaskUserState> {
  return apiRequest<TaskUserState>(
    `/tasks/${taskId}/state`,
    { method: "PATCH", body: JSON.stringify(input) },
    token,
  );
}

// ─── Submissions ─────────────────────────────────────────────────────────────

export async function listSubmissions(
  token: string,
  taskId: string,
): Promise<SubmissionListRow[]> {
  return apiRequest<SubmissionListRow[]>(
    `/tasks/${taskId}/submissions`,
    {},
    token,
  );
}

export async function getMySubmission(
  token: string,
  taskId: string,
): Promise<SubmissionDetail | null> {
  const result = await apiRequest<SubmissionDetail | undefined>(
    `/tasks/${taskId}/submissions/me`,
    {},
    token,
  );
  return result ?? null;
}

export async function getSubmission(
  token: string,
  taskId: string,
  submissionId: string,
): Promise<SubmissionDetail> {
  return apiRequest<SubmissionDetail>(
    `/tasks/${taskId}/submissions/${submissionId}`,
    {},
    token,
  );
}

export async function getSubmissionById(
  token: string,
  submissionId: string,
): Promise<SubmissionDetail> {
  return apiRequest<SubmissionDetail>(
    `/submissions/${submissionId}`,
    {},
    token,
  );
}

export async function upsertMySubmission(
  token: string,
  taskId: string,
  content: string | null,
): Promise<SubmissionDetail> {
  return apiRequest<SubmissionDetail>(
    `/tasks/${taskId}/submissions/me`,
    { method: "PUT", body: JSON.stringify({ content }) },
    token,
  );
}

export async function gradeSubmission(
  token: string,
  taskId: string,
  submissionId: string,
  input: { score?: string | null; reviewNote?: string | null },
): Promise<SubmissionDetail> {
  return apiRequest<SubmissionDetail>(
    `/tasks/${taskId}/submissions/${submissionId}/grade`,
    { method: "PATCH", body: JSON.stringify(input) },
    token,
  );
}

export async function exportSubmissionsCsv(
  token: string,
  taskId: string,
): Promise<string> {
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(
    `${getApiBaseUrl()}/tasks/${taskId}/submissions/export`,
    { headers },
  );
  if (!response.ok) {
    throw new ApiError("Export failed", "EXPORT_ERROR", response.status);
  }
  return response.text();
}

export async function batchRenameSubmissions(
  token: string,
  taskId: string,
): Promise<void> {
  return apiRequest<void>(
    `/tasks/${taskId}/submissions/rename`,
    { method: "POST" },
    token,
  );
}

// ─── Attachments ─────────────────────────────────────────────────────────────

export async function uploadTaskAttachment(
  token: string,
  taskId: string,
  file: File,
): Promise<AttachmentMeta> {
  const formData = new FormData();
  formData.append("file", file);
  // Backend returns AttachmentMeta[] — extract the first element
  const result = await apiRequest<AttachmentMeta[]>(
    `/tasks/${taskId}/attachments`,
    { method: "POST", body: formData },
    token,
  );
  return result[0];
}

export async function uploadSubmissionAttachment(
  token: string,
  taskId: string,
  file: File,
): Promise<AttachmentMeta> {
  const formData = new FormData();
  formData.append("file", file);
  // Backend returns AttachmentMeta[] — extract the first element
  const result = await apiRequest<AttachmentMeta[]>(
    `/tasks/${taskId}/submissions/me/attachments`,
    { method: "POST", body: formData },
    token,
  );
  return result[0];
}

export function getFileUrl(fileKey: string): string {
  return `${getApiBaseUrl()}/files/${fileKey}`;
}

export async function downloadFile(
  token: string,
  fileKey: string,
): Promise<string> {
  // GET /files/:fileKey returns a 302 redirect to presigned URL.
  // We fetch with auth, follow the redirect, and return the final blob URL.
  const res = await fetch(`${getApiBaseUrl()}/files/${fileKey}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new ApiError("Failed to download file", "DOWNLOAD_FAILED", res.status);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function downloadFileBlob(
  token: string,
  fileKey: string,
): Promise<Blob> {
  const res = await fetch(`${getApiBaseUrl()}/files/${fileKey}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new ApiError("Failed to download file", "DOWNLOAD_FAILED", res.status);
  }
  return res.blob();
}

export async function deleteAttachment(
  token: string,
  attachmentId: string,
): Promise<void> {
  return apiRequest<void>(
    `/files/attachments/${attachmentId}`,
    { method: "DELETE" },
    token,
  );
}

// ─── Admin (kept for admin panel) ────────────────────────────────────────────

export async function getAdminConfig(
  token: string,
): Promise<Record<string, string>> {
  return apiRequest<Record<string, string>>("/admin/config", {}, token);
}

export async function patchAdminConfig(
  token: string,
  entries: Record<string, string>,
): Promise<Record<string, string>> {
  return apiRequest<Record<string, string>>(
    "/admin/config",
    {
      method: "PATCH",
      body: JSON.stringify(entries),
    },
    token,
  );
}

export async function sendAdminTestEmail(
  token: string,
  to: string,
): Promise<void> {
  return apiRequest<void>(
    "/admin/config/test-email",
    {
      method: "POST",
      body: JSON.stringify({ to }),
    },
    token,
  );
}

export async function listAdminUsers(token: string): Promise<UserProfile[]> {
  return apiRequest<UserProfile[]>("/admin/users", {}, token);
}

export async function patchAdminUser(
  token: string,
  userId: string,
  input: AdminUpdateUserInput,
): Promise<UserProfile> {
  return apiRequest<UserProfile>(
    `/admin/users/${userId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
    token,
  );
}

export async function listAdminSchools(token: string): Promise<AdminSchool[]> {
  return apiRequest<AdminSchool[]>("/admin/schools", {}, token);
}

export async function createAdminSchool(
  token: string,
  name: string,
): Promise<AdminSchool> {
  return apiRequest<AdminSchool>(
    "/admin/schools",
    {
      method: "POST",
      body: JSON.stringify({ name }),
    },
    token,
  );
}

export async function deleteAdminSchool(
  token: string,
  schoolId: string,
): Promise<void> {
  return apiRequest<void>(
    `/admin/schools/${schoolId}`,
    {
      method: "DELETE",
    },
    token,
  );
}
