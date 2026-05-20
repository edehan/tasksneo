"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { getMe } from "@/lib/api";
import { readSafeNextParam } from "@/lib/search-params";

function getAuthenticatedRedirectTarget(): string {
  return readSafeNextParam() ?? "/";
}

export function AuthRedirectGuard({ children }: { children: React.ReactNode }) {
  const { user, setAuth } = useAuth();

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      getMe({ suppressAuthExpired: true })
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
