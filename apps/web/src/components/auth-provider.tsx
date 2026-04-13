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
  COOKIE_AUTH_PLACEHOLDER,
  logoutApi,
  subscribeToAuthExpired,
} from "@/lib/api";

interface AuthContextValue {
  token: string | null;
  user: UserProfile | null;
  loading: boolean;
  login: (
    email: string,
    password: string,
    trustDevice?: boolean,
  ) => Promise<void>;
  setAuth: (token: string, user: UserProfile) => void;
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
  const [token, setToken] = useState<string | null>(
    initialUser || initialHasSessionCookie ? COOKIE_AUTH_PLACEHOLDER : null,
  );
  const router = useRouter();
  const pathname = usePathname();

  const clearAuthState = useCallback(() => {
    setToken(null);
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
      setToken(COOKIE_AUTH_PLACEHOLDER);
      setUser(res.user);
      router.refresh();
    },
    [router],
  );

  const setAuth = useCallback((_: string, newUser: UserProfile) => {
    setToken(COOKIE_AUTH_PLACEHOLDER);
    setUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi(token);
    } catch {
      // Ignore best-effort revoke failures; clear local state regardless.
    }
    clearAuthState();
    router.push("/login");
    router.refresh();
  }, [clearAuthState, router, token]);

  const updateUser = useCallback((u: UserProfile) => {
    setUser(u);
    setToken(COOKIE_AUTH_PLACEHOLDER);
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      loading: false,
      login,
      setAuth,
      logout,
      updateUser,
    }),
    [token, user, login, setAuth, logout, updateUser],
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
