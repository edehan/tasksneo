"use client";

import type { AbstractIntlMessages } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import {
  LOCALE_COOKIE,
  LOCALE_STORAGE_KEY,
} from "@/components/locale-provider";

import {
  type AppLocale,
  DEFAULT_LOCALE,
  matchLocaleTag,
  resolvePreferredLocale,
  SUPPORTED_LOCALES,
  toHtmlLang,
} from "@/i18n/locale";
import enMessages from "@/i18n/messages/en.json";
import frMessages from "@/i18n/messages/fr.json";
import jaMessages from "@/i18n/messages/ja.json";
import zhCNMessages from "@/i18n/messages/zh-CN.json";

const MESSAGES_BY_LOCALE: Record<AppLocale, AbstractIntlMessages> = {
  en: enMessages,
  "zh-CN": zhCNMessages,
  fr: frMessages,
  ja: jaMessages,
};

function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() ?? null;
  }
  return null;
}

function readStoredLocale(): AppLocale | null {
  const cookieLocale = readCookieLocale();
  if (cookieLocale) {
    return cookieLocale;
  }

  return readLocalStorageLocale();
}

function readCookieLocale(): AppLocale | null {
  return matchLocaleTag(getCookie(LOCALE_COOKIE));
}

function readLocalStorageLocale(): AppLocale | null {
  try {
    return matchLocaleTag(localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return null;
  }
}

function detectClientLocale(): AppLocale {
  const storedLocale = readStoredLocale();
  if (storedLocale) {
    return storedLocale;
  }

  if (typeof navigator !== "undefined" && navigator.languages) {
    return resolvePreferredLocale(navigator.languages);
  }

  return DEFAULT_LOCALE;
}

function persistLocale(locale: AppLocale) {
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);

  // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API has insufficient browser support
  document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=${365 * 24 * 60 * 60};samesite=lax`;
}

function syncStoredLocale() {
  const cookieLocale = readCookieLocale();
  if (cookieLocale) {
    persistLocale(cookieLocale);
    return;
  }

  const localStorageLocale = readLocalStorageLocale();
  if (localStorageLocale) {
    persistLocale(localStorageLocale);
  }
}

export function useClientLocale() {
  const [locale, setLocale] = useState<AppLocale>(DEFAULT_LOCALE);
  const [messages, setMessages] = useState<AbstractIntlMessages>(
    MESSAGES_BY_LOCALE[DEFAULT_LOCALE],
  );

  const applyLocale = useCallback((nextLocale: AppLocale) => {
    setLocale(nextLocale);
    setMessages(MESSAGES_BY_LOCALE[nextLocale]);
    document.documentElement.lang = toHtmlLang(nextLocale);
  }, []);

  const setExplicitLocale = useCallback(
    (nextLocale: AppLocale) => {
      if (!SUPPORTED_LOCALES.includes(nextLocale)) return;
      persistLocale(nextLocale);
      applyLocale(nextLocale);
    },
    [applyLocale],
  );

  useEffect(() => {
    const detectedLocale = detectClientLocale();
    syncStoredLocale();
    applyLocale(detectedLocale);
  }, [applyLocale]);

  return { locale, messages, setLocale: setExplicitLocale };
}
