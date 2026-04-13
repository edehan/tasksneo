"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { UserProfile } from "@/lib/api";
import { login as apiLogin, logoutApi, subscribeToAuthExpired } from "@/lib/api";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

interface AuthContextValue {
  user: UserProfile | null;
  loading: false;
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

export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: UserProfile | null;
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<UserProfile | null>(initialUser);
  const router = useRouter();
  const pathname = usePathname();

  // Handle server-side auth expiry signals from API responses
  useEffect(() => {
    return subscribeToAuthExpired(() => {
      setUser(null);
      if (pathname !== "/login") {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      }
    });
  }, [pathname, router]);

  const login = useCallback(
    async (email: string, password: string, trustDevice?: boolean) => {
      const res = await apiLogin(email, password, trustDevice);
      // Cookie is set via Set-Cookie header; just update local user state
      setUser(res.user);
      router.refresh();
    },
    [router],
  );

  // Kept for register/complete flow compatibility — cookie is already set by API
  const setAuth = useCallback((_token: string, newUser: UserProfile) => {
    setUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // Ignore — API clears the cookie; local state is cleared below
    }
    setUser(null);
    router.push("/login");
    router.refresh();
  }, [router]);

  const updateUser = useCallback((u: UserProfile) => setUser(u), []);

  const value = useMemo(
    () => ({
      user,
      loading: false as const,
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
