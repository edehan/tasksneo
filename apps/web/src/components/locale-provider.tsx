"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useLocale } from "next-intl";
import { SUPPORTED_LOCALES, type AppLocale } from "@/i18n/locale";

const LOCALE_COOKIE = "taskflow_locale";
const LOCALE_STORAGE_KEY = "taskflow_locale";

interface LocaleContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const currentLocale = useLocale() as AppLocale;

  const setLocale = useCallback(
    (newLocale: AppLocale) => {
      if (newLocale === currentLocale) return;
      if (!SUPPORTED_LOCALES.includes(newLocale)) return;

      // Persist to localStorage
      localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);

      // Set cookie for server-side reading (1 year expiry)
      document.cookie = `${LOCALE_COOKIE}=${newLocale};path=/;max-age=${365 * 24 * 60 * 60};samesite=lax`;

      // Reload to re-render with the new locale on the server
      window.location.reload();
    },
    [currentLocale],
  );

  const value = useMemo(
    () => ({ locale: currentLocale, setLocale }),
    [currentLocale, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useAppLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useAppLocale must be used within LocaleProvider");
  }
  return ctx;
}
