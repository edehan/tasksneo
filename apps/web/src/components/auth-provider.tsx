"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { persistLocalePreference } from "@/components/locale-provider";
import type { UserProfile } from "@/lib/api";
import {
  login as apiLogin,
  logoutApi,
  subscribeToAuthExpired,
} from "@/lib/api";
import { isPublicAuthPath } from "@/lib/auth-paths";

interface AuthContextValue {
  user: UserProfile | null;
  hasSessionCookie: boolean;
  loading: boolean;
  login: (
    email: string,
    password: string,
    trustDevice?: boolean,
  ) => Promise<void>;
  setAuth: (user: UserProfile) => void;
  logout: () => Promise<void>;
  updateUser: (user: UserProfile) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  initialUser: UserProfile | null;
  initialHasSessionCookie?: boolean;
  children: React.ReactNode;
}

export function AuthProvider({
  initialUser,
  initialHasSessionCookie = false,
  children,
}: AuthProviderProps) {
  const [user, setUser] = useState<UserProfile | null>(initialUser);
  const [hasSessionCookie, setHasSessionCookie] = useState(
    initialHasSessionCookie,
  );
  const router = useRouter();
  const pathname = usePathname();

  const clearAuthState = useCallback(() => {
    setUser(null);
    setHasSessionCookie(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    persistLocalePreference(user.locale);
    if (
      !isPublicAuthPath(pathname) &&
      document.documentElement.lang !== user.locale
    ) {
      window.location.reload();
    }
  }, [pathname, user]);

  useEffect(() => {
    return subscribeToAuthExpired(() => {
      clearAuthState();
      if (!isPublicAuthPath(pathname)) {
        const search = window.location.search;
        router.replace(
          `/login?next=${encodeURIComponent(`${pathname}${search}`)}`,
        );
      }
    });
  }, [clearAuthState, pathname, router]);

  const login = useCallback(
    async (email: string, password: string, trustDevice?: boolean) => {
      const res = await apiLogin(email, password, trustDevice);
      persistLocalePreference(res.user.locale);
      setUser(res.user);
      setHasSessionCookie(true);
      router.refresh();
    },
    [router],
  );

  const setAuth = useCallback((newUser: UserProfile) => {
    persistLocalePreference(newUser.locale);
    setUser(newUser);
    setHasSessionCookie(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // Ignore best-effort revoke failures; clear local state regardless.
    }
    clearAuthState();
    // Don't preserve 'next' param on manual logout to avoid redirecting
    // the next user to a page they may not have access to
    router.push("/login");
    router.refresh();
  }, [clearAuthState, router]);

  const updateUser = useCallback((u: UserProfile) => {
    persistLocalePreference(u.locale);
    setUser(u);
  }, []);

  const value = useMemo(
    () => ({
      user,
      hasSessionCookie,
      loading: false,
      login,
      setAuth,
      logout,
      updateUser,
    }),
    [user, hasSessionCookie, login, setAuth, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
