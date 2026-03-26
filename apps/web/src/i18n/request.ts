import { headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import {
  DEFAULT_LOCALE,
  matchLocaleTag,
  resolveLocaleFromAcceptLanguage,
  type AppLocale,
} from "@/i18n/locale";
import { getMessagesForLocale } from "@/i18n/messages";

function ensureAppLocale(locale: string | null | undefined): AppLocale {
  const matched = matchLocaleTag(locale);
  return matched ?? DEFAULT_LOCALE;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const routeLocale = await requestLocale;

  let locale = ensureAppLocale(routeLocale);

  if (!routeLocale) {
    const headerStore = await headers();
    locale = resolveLocaleFromAcceptLanguage(
      headerStore.get("accept-language"),
    );
  }

  return {
    locale,
    messages: await getMessagesForLocale(locale),
  };
});
