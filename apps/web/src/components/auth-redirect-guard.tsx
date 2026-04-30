"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { getMe } from "@/lib/api";

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
    return (
      url.origin === window.location.origin && !AUTH_PATHS.has(url.pathname)
    );
  } catch {
    return false;
  }
}

function getAuthenticatedRedirectTarget(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return isSafeAuthenticatedTarget(next) ? next : "/";
}

export function AuthRedirectGuard({ children }: { children: React.ReactNode }) {
  const { user, setAuth } = useAuth();

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      getMe()
        .then((currentUser) => {
          if (cancelled) {
            return;
          }

          setAuth(currentUser);
          window.location.replace(getAuthenticatedRedirectTarget());
        })
        .catch(() => undefined);

      return () => {
        cancelled = true;
      };
    }

    window.location.replace(getAuthenticatedRedirectTarget());
    return () => {
      cancelled = true;
    };
  }, [setAuth, user]);

  if (user) {
    return null;
  }

  return children;
}
