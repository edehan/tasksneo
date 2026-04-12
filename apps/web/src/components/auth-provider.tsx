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
  getMe,
  logoutApi,
  subscribeToAuthExpired,
} from "@/lib/api";

const TOKEN_KEY = "taskflow_token";

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const clearAuthState = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setLoading(false);
      return;
    }

    setToken(stored);
    getMe(stored)
      .then((u) => setUser(u))
      .catch(() => {
        clearAuthState();
      })
      .finally(() => setLoading(false));
  }, [clearAuthState]);

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
      localStorage.setItem(TOKEN_KEY, res.token);
      setToken(res.token);
      setUser(res.user);
    },
    [],
  );

  const setAuth = useCallback((newToken: string, newUser: UserProfile) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    // Best-effort server-side revocation. If the request fails (network,
    // already-expired token, etc.) we still clear local state so the user
    // ends up logged out locally regardless.
    const current = token;
    if (current) {
      try {
        await logoutApi(current);
      } catch {
        // Ignore — the local clear below is the source of truth for the UI.
      }
    }
    clearAuthState();
  }, [clearAuthState, token]);

  const updateUser = useCallback((u: UserProfile) => {
    setUser(u);
  }, []);

  const value = useMemo(
    () => ({ token, user, loading, login, setAuth, logout, updateUser }),
    [token, user, loading, login, setAuth, logout, updateUser],
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
