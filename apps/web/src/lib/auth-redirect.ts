import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export function normalizeNextPath(
  next: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!next) {
    return fallback;
  }

  if (!next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }

  return next;
}

export function buildLoginHref(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}

export function getCurrentPathWithQuery(): string {
  if (typeof window === "undefined") {
    return "/dashboard";
  }

  return `${window.location.pathname}${window.location.search}`;
}

export function redirectToLogin(
  router: AppRouterInstance,
  next = getCurrentPathWithQuery(),
): void {
  router.replace(buildLoginHref(next));
}
