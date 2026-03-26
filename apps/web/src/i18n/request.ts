import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import {
  DEFAULT_LOCALE,
  matchLocaleTag,
  resolveLocaleFromAcceptLanguage,
  type AppLocale,
} from "@/i18n/locale";
import { getMessagesForLocale } from "@/i18n/messages";

const LOCALE_COOKIE = "taskflow_locale";

function ensureAppLocale(locale: string | null | undefined): AppLocale {
  const matched = matchLocaleTag(locale);
  return matched ?? DEFAULT_LOCALE;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const routeLocale = await requestLocale;

  let locale = ensureAppLocale(routeLocale);

  if (!routeLocale) {
    // 1. Check user's explicit locale preference (cookie)
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
    const matched = matchLocaleTag(cookieLocale);

    if (matched) {
      locale = matched;
    } else {
      // 2. Fall back to browser Accept-Language header
      const headerStore = await headers();
      locale = resolveLocaleFromAcceptLanguage(
        headerStore.get("accept-language"),
      );
    }
  }

  return {
    locale,
    messages: await getMessagesForLocale(locale),
  };
});
