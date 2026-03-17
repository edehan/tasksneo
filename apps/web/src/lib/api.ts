export interface ApiErrorShape {
  error: string;
  code: string;
}

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

export interface AdminSchool {
  id: string;
  name: string;
}

export interface AdminUpdateUserInput {
  isActive?: boolean;
  password?: string;
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

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(init.headers ?? {});

  if (!headers.has("Content-Type") && init.body) {
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
