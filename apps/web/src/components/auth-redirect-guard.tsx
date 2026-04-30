"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth-provider";

const AUTH_PATHS = new Set([
  "/login",
  "/register",
  "/register/complete",
  "/forgot-password",
  "/reset-password",
]);

function isSafeAuthenticatedTarget(value: string | null): value is string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return false;
  }

  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin && !AUTH_PATHS.has(url.pathname);
  } catch {
    return false;
  }
}

function getAuthenticatedRedirectTarget(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return isSafeAuthenticatedTarget(next) ? next : "/";
}

export function AuthRedirectGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      return;
    }

    router.replace(getAuthenticatedRedirectTarget());
  }, [router, user]);

  if (user) {
    return null;
  }

  return children;
}
