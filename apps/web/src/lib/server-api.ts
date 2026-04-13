import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type {
  ClassSummary,
  MyTaskSummary,
  SubmissionDetail,
  SubmissionListRow,
  TaskDetail,
  TaskSummary,
  UserProfile,
} from "@/lib/api";

function getApiInternalUrl(): string {
  return (
    process.env.API_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://localhost:3001"
  );
}

async function buildCookieHeader(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const all = cookieStore.getAll();
  if (all.length === 0) {
    return undefined;
  }
  return all.map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join("; ");
}

export async function serverApiRequest<T>(
  path: string,
  init: RequestInit = {},
  options?: { redirectOn401?: boolean },
): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  const cookieHeader = await buildCookieHeader();

  if (cookieHeader) {
    headers.set("Cookie", cookieHeader);
  }

  if (
    !headers.has("Content-Type") &&
    init.body &&
    !(typeof FormData !== "undefined" && init.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${getApiInternalUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (response.status === 401 && options?.redirectOn401) {
    redirect("/login");
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(body.error ?? `API ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function getServerUser(): Promise<UserProfile | null> {
  try {
    return await serverApiRequest<UserProfile>("/users/me");
  } catch {
    return null;
  }
}

const redirectOn401 = { redirectOn401: true } as const;

export const getServerUserOrRedirect = cache(
  async (): Promise<UserProfile> =>
    serverApiRequest<UserProfile>("/users/me", {}, redirectOn401),
);

export const getServerClasses = cache(
  async (): Promise<ClassSummary[]> =>
    serverApiRequest<ClassSummary[]>("/classes", {}, redirectOn401),
);

export const getServerMyTasks = cache(
  async (): Promise<MyTaskSummary[]> =>
    serverApiRequest<MyTaskSummary[]>("/tasks/mine", {}, redirectOn401),
);

export const getServerClass = cache(
  async (classId: string): Promise<ClassSummary> =>
    serverApiRequest<ClassSummary>(`/classes/${classId}`, {}, redirectOn401),
);

export const getServerClassTasks = cache(
  async (classId: string): Promise<TaskSummary[]> =>
    serverApiRequest<TaskSummary[]>(
      `/classes/${classId}/tasks`,
      {},
      redirectOn401,
    ),
);

export const getServerTask = cache(
  async (taskId: string): Promise<TaskDetail> =>
    serverApiRequest<TaskDetail>(`/tasks/${taskId}`, {}, redirectOn401),
);

export const getServerTaskSubmissions = cache(
  async (taskId: string): Promise<SubmissionListRow[]> =>
    serverApiRequest<SubmissionListRow[]>(
      `/tasks/${taskId}/submissions`,
      {},
      redirectOn401,
    ),
);

export const getServerSubmissionById = cache(
  async (submissionId: string): Promise<SubmissionDetail> =>
    serverApiRequest<SubmissionDetail>(
      `/submissions/${submissionId}`,
      {},
      redirectOn401,
    ),
);
