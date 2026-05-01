"use client";

import { isSafeAuthenticatedRedirectPath } from "@/lib/auth-paths";

export function readWindowSearchParam(name: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return new URLSearchParams(window.location.search).get(name);
}

export function readSafeNextParam(): string | null {
  const next = readWindowSearchParam("next");

  return isSafeAuthenticatedRedirectPath(next) ? next : null;
}
