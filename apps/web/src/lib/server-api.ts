import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UserProfile } from "@/lib/api";

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
