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
import type { UserProfile } from "@/lib/api";
import {
  login as apiLogin,
  logoutApi,
  subscribeToAuthExpired,
} from "@/lib/api";

interface AuthContextValue {
  user: UserProfile | null;
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
  initialHasSessionCookie: _initialHasSessionCookie = false,
  children,
}: AuthProviderProps) {
  const [user, setUser] = useState<UserProfile | null>(initialUser);
  const router = useRouter();
  const pathname = usePathname();

  const clearAuthState = useCallback(() => {
    setUser(null);
  }, []);

  useEffect(() => {
    return subscribeToAuthExpired(() => {
      clearAuthState();
      if (pathname !== "/login") {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      }
    });
  }, [clearAuthState, pathname, router]);

  const login = useCallback(
    async (email: string, password: string, trustDevice?: boolean) => {
      const res = await apiLogin(email, password, trustDevice);
      setUser(res.user);
      router.refresh();
    },
    [router],
  );

  const setAuth = useCallback((newUser: UserProfile) => {
    setUser(newUser);
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
    setUser(u);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading: false,
      login,
      setAuth,
      logout,
      updateUser,
    }),
    [user, login, setAuth, logout, updateUser],
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
