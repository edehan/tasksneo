import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UserProfile } from "@/lib/api";

const SESSION_COOKIE_NAME = "tfses_session";

function getApiInternalUrl(): string {
  return (
    process.env.API_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://localhost:3001"
  );
}

export async function serverApiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  const headers = new Headers(init?.headers ?? {});
  if (sessionCookie) {
    headers.set("Cookie", `${SESSION_COOKIE_NAME}=${sessionCookie.value}`);
  }
  if (!headers.has("Content-Type") && !(init?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${getApiInternalUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (response.status === 401) {
    redirect("/login");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `API ${response.status}`,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Returns the current user from the session cookie, or null if not authenticated. */
export async function getServerUser(): Promise<UserProfile | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!sessionCookie?.value) return null;

  try {
    return await serverApiRequest<UserProfile>("/users/me");
  } catch {
    return null;
  }
}
