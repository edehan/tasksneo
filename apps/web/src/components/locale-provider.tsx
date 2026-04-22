"use client";

import { useLocale } from "next-intl";
import { createContext, useCallback, useContext, useMemo } from "react";
import { type AppLocale, SUPPORTED_LOCALES } from "@/i18n/locale";

export const LOCALE_COOKIE = "taskflow_locale";
export const LOCALE_STORAGE_KEY = "taskflow_locale";

export interface LocaleContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function AppLocaleProvider({
  children,
  locale,
  setLocale,
}: {
  children: React.ReactNode;
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
}) {
  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const currentLocale = useLocale() as AppLocale;

  const setLocale = useCallback(
    (newLocale: AppLocale) => {
      if (newLocale === currentLocale) return;
      if (!SUPPORTED_LOCALES.includes(newLocale)) return;

      // Persist to localStorage
      localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);

      // Set cookie for server-side reading (1 year expiry)
      // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API has insufficient browser support
      document.cookie = `${LOCALE_COOKIE}=${newLocale};path=/;max-age=${365 * 24 * 60 * 60};samesite=lax`;

      // Reload to re-render with the new locale on the server
      window.location.reload();
    },
    [currentLocale],
  );

  return (
    <AppLocaleProvider locale={currentLocale} setLocale={setLocale}>
      {children}
    </AppLocaleProvider>
  );
}

export function useAppLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useAppLocale must be used within LocaleProvider");
  }
  return ctx;
}
