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

const AUTH_EXPIRED_EVENT = "taskflow:auth-expired";
const AUTH_ERROR_CODES = new Set(["UNAUTHORIZED", "USER_INACTIVE"]);

export const ADMIN_TOKEN_STORAGE_KEY = "taskflow_admin_token";

function isAdminPath(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/");
}

function readAdminToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
}

function emitAuthExpired() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}

export function subscribeToAuthExpired(handler: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(AUTH_EXPIRED_EVENT, handler);
  return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
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
  avatarFileKey: string | null;
  createdAt: string;
}

export interface AuthResponse {
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

export type JoinClassPreviewStatus =
  | "JOINABLE"
  | "ALREADY_MEMBER"
  | "SCHOOL_MISMATCH";

export interface JoinClassPreview {
  id: string;
  name: string;
  description: string | null;
  color: string;
  schoolId: string | null;
  schoolName: string | null;
  inviteCode: string;
  memberCount: number;
  status: JoinClassPreviewStatus;
  myRole: "OWNER" | "ADMIN" | "MEMBER" | null;
}

export interface ClassMember {
  userId: string;
  nickname: string | null;
  avatarHash: string;
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
  isVisible: boolean;
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
  isExemplary: boolean;
}

export interface SubmissionDetail extends SubmissionSummary {
  attachments: AttachmentMeta[];
}

/** Row returned by GET /tasks/:taskId/submissions (admin list) */
export interface SubmissionListRow {
  userId: string;
  nickname: string | null;
  avatarHash: string;
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
  type: "TASK_PUBLISHED" | "TASK_DUE_REMINDER" | "SITE_ANNOUNCEMENT";
  taskId: string | null;
  classId: string | null;
  taskTitle: string;
  className: string;
  title: string | null;
  content: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  nextCursor: string | null;
  unreadCount: number;
}

export interface McpKeyInfo {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface McpKeyCreated extends McpKeyInfo {
  key: string;
}

export type SessionKind = "BROWSER" | "MCP";

export interface SessionInfo {
  id: string;
  kind: SessionKind;
  isTrusted: boolean;
  isCurrent: boolean;
  userAgent: string | null;
  ipAddress: string | null;
  country: string | null;
  mcpKeyId: string | null;
  mcpKeyName: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string | null;
}

// ─── Admin Types (kept for admin panel) ──────────────────────────────────────

export interface AdminSchool {
  id: string;
  name: string;
}

export interface AdminAnnouncement {
  id: string;
  title: string;
  content: string;
  status: "SCHEDULED" | "PUBLISHED" | "CANCELLED";
  scheduledAt: string;
  publishedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
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
): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  const adminPath = isAdminPath(path);

  if (
    !headers.has("Content-Type") &&
    init.body &&
    !(init.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  if (adminPath && !headers.has("Authorization")) {
    const adminToken = readAdminToken();
    if (adminToken) {
      headers.set("Authorization", `Bearer ${adminToken}`);
    }
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
    credentials: "include",
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

    if (
      !adminPath &&
      (response.status === 401 || AUTH_ERROR_CODES.has(errorCode))
    ) {
      emitAuthExpired();
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
  trustDevice?: boolean,
): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      ...(trustDevice ? { trustDevice: true } : {}),
    }),
  });
}

export async function logoutApi(): Promise<void> {
  return apiRequest<void>("/auth/logout", { method: "POST" });
}

export async function register(
  email: string,
  captchaToken?: string | null,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      ...(captchaToken ? { captchaToken } : {}),
    }),
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
  trustDevice?: boolean;
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
): Promise<{ message: string; user: UserProfile }> {
  return apiRequest<{ message: string; user: UserProfile }>(
    "/auth/reset-password",
    {
      method: "POST",
      body: JSON.stringify({ token, password }),
    },
  );
}

export async function requestEmailChange(
  newEmail: string,
  captchaToken?: string | null,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/users/me/email/change", {
    method: "POST",
    body: JSON.stringify({
      email: newEmail,
      ...(captchaToken ? { captchaToken } : {}),
    }),
  });
}

export async function confirmEmailChange(
  verificationToken: string,
): Promise<UserProfile> {
  return apiRequest<UserProfile>("/users/me/email/confirm", {
    method: "POST",
    body: JSON.stringify({ token: verificationToken }),
  });
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function getMe(): Promise<UserProfile> {
  return apiRequest<UserProfile>("/users/me", {});
}

export async function updateProfile(input: {
  nickname?: string | null;
  schoolId?: string | null;
  studentId?: string | null;
  timezone?: string;
}): Promise<UserProfile> {
  return apiRequest<UserProfile>("/users/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function updatePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  return apiRequest<void>("/users/me/password", {
    method: "PATCH",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function getNotificationPrefs(): Promise<NotificationPref[]> {
  return apiRequest<NotificationPref[]>("/users/me/notification-prefs", {});
}

export async function upsertNotificationPref(input: {
  channel: "EMAIL" | "WEBHOOK" | "TELEGRAM";
  address: string;
  isEnabled?: boolean;
}): Promise<NotificationPref> {
  return apiRequest<NotificationPref>("/users/me/notification-prefs", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function listMyNotifications(params?: {
  limit?: number;
  cursor?: string;
  unreadOnly?: boolean;
}): Promise<NotificationListResponse> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.cursor) query.set("cursor", params.cursor);
  if (params?.unreadOnly) query.set("unreadOnly", "true");
  const qs = query.toString();
  return apiRequest<NotificationListResponse>(
    `/users/me/notifications${qs ? `?${qs}` : ""}`,
    {},
  );
}

export async function markNotificationRead(id: string): Promise<void> {
  return apiRequest<void>(`/users/me/notifications/${id}/read`, {
    method: "PATCH",
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  return apiRequest<void>("/users/me/notifications/read-all", {
    method: "POST",
  });
}

export async function getUnreadNotificationCount(): Promise<{
  unreadCount: number;
}> {
  return apiRequest<{ unreadCount: number }>(
    "/users/me/notifications/unread-count",
    {},
  );
}

// ── MCP keys ───────────────────────────────────────────────────────────────

export async function listMcpKeys(): Promise<McpKeyInfo[]> {
  return apiRequest<McpKeyInfo[]>("/users/me/mcp-keys", {});
}

export async function createMcpKey(name: string): Promise<McpKeyCreated> {
  return apiRequest<McpKeyCreated>("/users/me/mcp-keys", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function revokeMcpKey(keyId: string): Promise<McpKeyInfo> {
  return apiRequest<McpKeyInfo>(`/users/me/mcp-keys/${keyId}`, {
    method: "DELETE",
  });
}

// ── Sessions ───────────────────────────────────────────────────────────────

export async function listSessions(): Promise<SessionInfo[]> {
  return apiRequest<SessionInfo[]>("/users/me/sessions", {});
}

export async function revokeSession(sessionId: string): Promise<void> {
  return apiRequest<void>(`/users/me/sessions/${sessionId}`, {
    method: "DELETE",
  });
}

export async function revokeOtherSessions(): Promise<void> {
  return apiRequest<void>("/users/me/sessions", { method: "DELETE" });
}

// ── Account ────────────────────────────────────────────────────────────────

export async function deleteAccount(): Promise<void> {
  return apiRequest<void>("/users/me/delete", { method: "POST" });
}

// ─── Schools ─────────────────────────────────────────────────────────────────

export async function listSchools(): Promise<School[]> {
  return apiRequest<School[]>("/schools");
}

// ─── Classes ─────────────────────────────────────────────────────────────────

export async function listClasses(): Promise<ClassSummary[]> {
  return apiRequest<ClassSummary[]>("/classes", {});
}

export async function createClass(input: {
  name: string;
  description?: string | null;
  color?: string;
  schoolId?: string | null;
}): Promise<ClassSummary> {
  return apiRequest<ClassSummary>("/classes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function joinClass(inviteCode: string): Promise<ClassSummary> {
  return apiRequest<ClassSummary>("/classes/join", {
    method: "POST",
    body: JSON.stringify({ inviteCode }),
  });
}

export async function getJoinClassPreview(
  inviteCode: string,
): Promise<JoinClassPreview> {
  return apiRequest<JoinClassPreview>(
    `/classes/join-preview/${encodeURIComponent(inviteCode)}`,
    {},
  );
}

export async function getClass(classId: string): Promise<ClassSummary> {
  return apiRequest<ClassSummary>(`/classes/${classId}`, {});
}

export async function updateClass(
  classId: string,
  input: { name?: string; description?: string | null; color?: string },
): Promise<ClassSummary> {
  return apiRequest<ClassSummary>(`/classes/${classId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteClass(classId: string): Promise<void> {
  return apiRequest<void>(`/classes/${classId}`, { method: "DELETE" });
}

export async function refreshInviteCode(
  classId: string,
): Promise<{ inviteCode: string }> {
  return apiRequest<{ inviteCode: string }>(`/classes/${classId}/invite-code`, {
    method: "POST",
  });
}

export async function transferOwnership(
  classId: string,
  newOwnerId: string,
): Promise<ClassSummary> {
  return apiRequest<ClassSummary>(`/classes/${classId}/transfer`, {
    method: "POST",
    body: JSON.stringify({ newOwnerId }),
  });
}

export async function listMembers(classId: string): Promise<ClassMember[]> {
  return apiRequest<ClassMember[]>(`/classes/${classId}/members`, {});
}

export async function updateMemberRole(
  classId: string,
  userId: string,
  role: "ADMIN" | "MEMBER",
): Promise<ClassMember> {
  return apiRequest<ClassMember>(`/classes/${classId}/members/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export async function removeMember(
  classId: string,
  userId: string,
): Promise<void> {
  return apiRequest<void>(`/classes/${classId}/members/${userId}`, {
    method: "DELETE",
  });
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export async function listClassTasks(classId: string): Promise<TaskSummary[]> {
  return apiRequest<TaskSummary[]>(`/classes/${classId}/tasks`, {});
}

interface DraftWithAttachments extends TaskSummary {
  attachments: AttachmentMeta[];
}

export async function getMyClassDraft(
  classId: string,
): Promise<DraftWithAttachments | null> {
  const res = await apiRequest<{ draft: DraftWithAttachments | null }>(
    `/classes/${classId}/tasks/drafts/mine`,
    {},
  );
  return res.draft;
}

export interface MyTaskSummary extends TaskSummary {
  classColor: string | null;
}

export async function listMyTasks(): Promise<MyTaskSummary[]> {
  return apiRequest<MyTaskSummary[]>("/tasks/mine", {});
}

export async function createTask(
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
  return apiRequest<TaskDetail>(`/classes/${classId}/tasks`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function createTaskDraft(
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
  return apiRequest<TaskSummary>(`/classes/${classId}/tasks/drafts`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function parseTask(text: string): Promise<ParseTaskResponse> {
  return apiRequest<ParseTaskResponse>("/tasks/parse", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function parseTaskDraft(
  taskId: string,
  text?: string,
): Promise<ParseDraftTaskResponse> {
  return apiRequest<ParseDraftTaskResponse>(`/tasks/${taskId}/parse`, {
    method: "POST",
    body: JSON.stringify(text ? { text } : {}),
  });
}

// ─── Speech-to-Text ──────────────────────────────────────────────────────────

export async function getSTTToken(): Promise<{
  token: string;
  speechModel: string;
}> {
  return apiRequest<{ token: string; speechModel: string }>("/stt/token", {
    method: "POST",
  });
}

// ─── AI Content Revision ─────────────────────────────────────────────────────

export interface ReviseResponse {
  revisedContent: string;
}

export async function reviseTaskContent(
  taskId: string,
  currentContent: string,
  instruction: string,
): Promise<ReviseResponse> {
  return apiRequest<ReviseResponse>(`/tasks/${taskId}/revise`, {
    method: "POST",
    body: JSON.stringify({ currentContent, instruction }),
  });
}

export async function getTaskDraftMarkdown(
  taskId: string,
): Promise<{ markdown: string | null }> {
  return apiRequest<{ markdown: string | null }>(
    `/tasks/${taskId}/draft-markdown`,
    {},
  );
}

export async function getTask(taskId: string): Promise<TaskDetail> {
  return apiRequest<TaskDetail>(`/tasks/${taskId}`, {});
}

export async function updateTask(
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
  return apiRequest<TaskDetail>(`/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function publishTaskDraft(
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
  return apiRequest<TaskSummary>(`/tasks/${taskId}/publish`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deleteTask(taskId: string): Promise<void> {
  return apiRequest<void>(`/tasks/${taskId}`, { method: "DELETE" });
}

export async function markTaskViewed(taskId: string): Promise<void> {
  return apiRequest<void>(`/tasks/${taskId}/view`, { method: "POST" });
}

export async function updateTaskState(
  taskId: string,
  input: { tags?: string[]; sortOrder?: number },
): Promise<TaskUserState> {
  return apiRequest<TaskUserState>(`/tasks/${taskId}/state`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

// ─── Comments ───────────────────────────────────────────────────────────────

export interface CommentAuthor {
  id: string;
  nickname: string | null;
  avatarHash: string | null;
}

export interface TaskComment {
  id: string;
  content: string;
  createdAt: string;
  author: CommentAuthor | null;
  replyTo: { id: string; nickname: string | null } | null;
}

export async function listTaskComments(taskId: string): Promise<TaskComment[]> {
  const res = await apiRequest<{ comments: TaskComment[] }>(
    `/tasks/${taskId}/comments`,
    {},
  );
  return res.comments;
}

export async function createTaskComment(
  taskId: string,
  content: string,
  replyToId?: string | null,
): Promise<TaskComment> {
  return apiRequest<TaskComment>(`/tasks/${taskId}/comments`, {
    method: "POST",
    body: JSON.stringify({ content, replyToId: replyToId ?? null }),
  });
}

// ─── Submissions ─────────────────────────────────────────────────────────────

export async function listSubmissions(
  taskId: string,
): Promise<SubmissionListRow[]> {
  return apiRequest<SubmissionListRow[]>(`/tasks/${taskId}/submissions`, {});
}

export async function getMySubmission(
  taskId: string,
): Promise<SubmissionDetail | null> {
  const result = await apiRequest<SubmissionDetail | undefined>(
    `/tasks/${taskId}/submissions/me`,
    {},
  );
  return result ?? null;
}

export async function getSubmission(
  taskId: string,
  submissionId: string,
): Promise<SubmissionDetail> {
  return apiRequest<SubmissionDetail>(
    `/tasks/${taskId}/submissions/${submissionId}`,
    {},
  );
}

export async function getSubmissionById(
  submissionId: string,
): Promise<SubmissionDetail> {
  return apiRequest<SubmissionDetail>(`/submissions/${submissionId}`, {});
}

export async function upsertMySubmission(
  taskId: string,
  content: string | null,
): Promise<SubmissionDetail> {
  return apiRequest<SubmissionDetail>(`/tasks/${taskId}/submissions/me`, {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
}

export async function gradeSubmission(
  taskId: string,
  submissionId: string,
  input: { score?: string | null; reviewNote?: string | null },
): Promise<SubmissionDetail> {
  return apiRequest<SubmissionDetail>(
    `/tasks/${taskId}/submissions/${submissionId}/grade`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export async function toggleExemplary(
  taskId: string,
  submissionId: string,
): Promise<SubmissionDetail> {
  return apiRequest<SubmissionDetail>(
    `/tasks/${taskId}/submissions/${submissionId}/exemplary`,
    { method: "PATCH" },
  );
}

export async function exportSubmissionsCsv(taskId: string): Promise<string> {
  const response = await fetch(
    `${getApiBaseUrl()}/tasks/${taskId}/submissions/export`,
    { credentials: "include" },
  );
  if (!response.ok) {
    throw new ApiError("Export failed", "EXPORT_ERROR", response.status);
  }
  return response.text();
}

export async function batchRenameSubmissions(taskId: string): Promise<void> {
  return apiRequest<void>(`/tasks/${taskId}/submissions/rename`, {
    method: "POST",
  });
}

// ─── Attachments ─────────────────────────────────────────────────────────────

interface DirectUploadTarget {
  fileKey: string;
  uploadUrl: string;
  expiresIn: number;
  headers: Record<string, string>;
}

interface CompletedUploadMetadata {
  fileKey: string;
  originalName: string;
  mimeType: string | null;
  sizeBytes: number;
}

async function uploadFileToObjectStorage(
  upload: DirectUploadTarget,
  file: File,
): Promise<CompletedUploadMetadata> {
  const response = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers: upload.headers,
    body: file,
    credentials: "omit",
  });

  if (!response.ok) {
    throw new ApiError(
      "Failed to upload file",
      "UPLOAD_FAILED",
      response.status,
    );
  }

  return {
    fileKey: upload.fileKey,
    originalName: file.name,
    mimeType: file.type || null,
    sizeBytes: file.size,
  };
}

export async function uploadTaskAttachment(
  taskId: string,
  file: File,
  options?: { isVisible?: boolean },
): Promise<AttachmentMeta> {
  const [upload] = await apiRequest<DirectUploadTarget[]>(
    `/tasks/${taskId}/attachments/upload-url`,
    {
      method: "POST",
      body: JSON.stringify({
        files: [
          {
            name: file.name,
            mimeType: file.type || null,
            sizeBytes: file.size,
          },
        ],
      }),
    },
  );
  if (!upload) {
    throw new ApiError(
      "Upload URL was not returned",
      "UPLOAD_URL_MISSING",
      500,
    );
  }
  const attachment = await uploadFileToObjectStorage(upload, file);
  const result = await apiRequest<AttachmentMeta[]>(
    `/tasks/${taskId}/attachments`,
    {
      method: "POST",
      body: JSON.stringify({
        attachments: [attachment],
        ...(options?.isVisible !== undefined
          ? { isVisible: options.isVisible }
          : {}),
      }),
    },
  );
  return result[0];
}

export async function uploadSubmissionAttachment(
  taskId: string,
  file: File,
): Promise<AttachmentMeta> {
  const [upload] = await apiRequest<DirectUploadTarget[]>(
    `/tasks/${taskId}/submissions/me/attachments/upload-url`,
    {
      method: "POST",
      body: JSON.stringify({
        files: [
          {
            name: file.name,
            mimeType: file.type || null,
            sizeBytes: file.size,
          },
        ],
      }),
    },
  );
  if (!upload) {
    throw new ApiError(
      "Upload URL was not returned",
      "UPLOAD_URL_MISSING",
      500,
    );
  }
  const attachment = await uploadFileToObjectStorage(upload, file);
  const result = await apiRequest<AttachmentMeta[]>(
    `/tasks/${taskId}/submissions/me/attachments`,
    {
      method: "POST",
      body: JSON.stringify({ attachments: [attachment] }),
    },
  );
  return result[0];
}

export function getFileUrl(fileKey: string): string {
  return `${getApiBaseUrl()}/files/${fileKey}`;
}

export async function getPresignedFileUrl(fileKey: string): Promise<string> {
  const res = await apiRequest<{ url: string }>(`/files/${fileKey}/url`, {});
  return res.url;
}

export async function downloadFile(fileKey: string): Promise<string> {
  // GET /files/:fileKey returns a 302 redirect to presigned URL.
  // We fetch with auth, follow the redirect, and return the final blob URL.
  const res = await fetch(`${getApiBaseUrl()}/files/${fileKey}`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new ApiError(
      "Failed to download file",
      "DOWNLOAD_FAILED",
      res.status,
    );
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function downloadFileBlob(fileKey: string): Promise<Blob> {
  const res = await fetch(`${getApiBaseUrl()}/files/${fileKey}`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new ApiError(
      "Failed to download file",
      "DOWNLOAD_FAILED",
      res.status,
    );
  }
  return res.blob();
}

export async function deleteAttachment(attachmentId: string): Promise<void> {
  return apiRequest<void>(`/files/attachments/${attachmentId}`, {
    method: "DELETE",
  });
}

export async function updateAttachmentVisibility(
  attachmentId: string,
  isVisible: boolean,
): Promise<AttachmentMeta> {
  return apiRequest<AttachmentMeta>(`/files/attachments/${attachmentId}`, {
    method: "PATCH",
    body: JSON.stringify({ isVisible }),
  });
}

// ─── Admin (kept for admin panel) ────────────────────────────────────────────

export interface StorageStatus {
  endpoint: string;
  bucket: string;
  useSSL: boolean;
  region: string;
  connected: boolean;
  error?: string;
}

export async function getAdminStorageStatus(): Promise<StorageStatus> {
  return apiRequest<StorageStatus>("/admin/storage-status", {});
}

export interface AdminMetricsRoute {
  route: string;
  count: number;
  errors: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
}

export interface AdminMetrics {
  uptime_s: number;
  requests_total: number;
  requests_by_status: Record<string, number>;
  routes: AdminMetricsRoute[];
}

export async function getAdminMetrics(): Promise<AdminMetrics> {
  return apiRequest<AdminMetrics>("/admin/metrics", {});
}

export interface AdminQueueJobCounts {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  paused: number;
}

export interface AdminQueueDelayedJob {
  id: string;
  name: string;
  data: Record<string, unknown>;
  processAt: string;
}

export interface AdminQueueFailedJob {
  id: string;
  name: string;
  failedReason: string | null;
  attemptsMade: number;
  timestamp: string;
}

export interface AdminQueueRepeatableJob {
  key: string;
  name: string;
  pattern: string;
  next: string | null;
}

export interface AdminQueueStats {
  jobCounts: AdminQueueJobCounts;
  delayedJobs: AdminQueueDelayedJob[];
  failedJobs: AdminQueueFailedJob[];
  repeatableJobs: AdminQueueRepeatableJob[];
}

export async function getAdminQueueStats(): Promise<AdminQueueStats> {
  return apiRequest<AdminQueueStats>("/admin/queue", {});
}

export async function getAdminConfig(): Promise<Record<string, string>> {
  return apiRequest<Record<string, string>>("/admin/config", {});
}

export async function patchAdminConfig(
  entries: Record<string, string>,
): Promise<Record<string, string>> {
  return apiRequest<Record<string, string>>("/admin/config", {
    method: "PATCH",
    body: JSON.stringify(entries),
  });
}

export async function sendAdminTestEmail(to: string): Promise<void> {
  return apiRequest<void>("/admin/config/test-email", {
    method: "POST",
    body: JSON.stringify({ to }),
  });
}

export async function listAdminUsers(): Promise<UserProfile[]> {
  return apiRequest<UserProfile[]>("/admin/users", {});
}

export async function patchAdminUser(
  userId: string,
  input: AdminUpdateUserInput,
): Promise<UserProfile> {
  return apiRequest<UserProfile>(`/admin/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function listAdminSchools(): Promise<AdminSchool[]> {
  return apiRequest<AdminSchool[]>("/admin/schools", {});
}

export async function createAdminSchool(name: string): Promise<AdminSchool> {
  return apiRequest<AdminSchool>("/admin/schools", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function deleteAdminSchool(schoolId: string): Promise<void> {
  return apiRequest<void>(`/admin/schools/${schoolId}`, {
    method: "DELETE",
  });
}

// ── Admin Announcements ──────────────────────────────────────────────────────

export async function listAdminAnnouncements(): Promise<AdminAnnouncement[]> {
  return apiRequest<AdminAnnouncement[]>("/admin/announcements", {});
}

export async function createAdminAnnouncement(input: {
  title: string;
  content: string;
  publishMode?: "immediate" | "delayed";
}): Promise<AdminAnnouncement> {
  return apiRequest<AdminAnnouncement>("/admin/announcements", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function cancelAdminAnnouncement(
  announcementId: string,
): Promise<AdminAnnouncement> {
  return apiRequest<AdminAnnouncement>(
    `/admin/announcements/${announcementId}/cancel`,
    { method: "POST" },
  );
}
