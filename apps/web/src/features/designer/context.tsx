"use client";

import { createContext, useContext } from "react";

import type { ClassSummary } from "@/lib/api";

export interface AppShellContextValue {
  classes: ClassSummary[];
  loadingClasses: boolean;
  refreshClasses: () => Promise<void>;
  openJoinDialog: () => void;
  openCreateDialog: () => void;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

export function AppShellContextProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: AppShellContextValue;
}) {
  return (
    <AppShellContext.Provider value={value}>
      {children}
    </AppShellContext.Provider>
  );
}

export function useAppShell() {
  const context = useContext(AppShellContext);
  if (!context) {
    throw new Error("useAppShell must be used inside AppShellContextProvider");
  }
  return context;
}
