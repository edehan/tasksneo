import type { AbstractIntlMessages } from "next-intl";

import type { AppLocale } from "@/i18n/locale";

export async function getMessagesForLocale(
  locale: AppLocale,
): Promise<AbstractIntlMessages> {
  switch (locale) {
    case "zh-CN":
      return (await import("@/i18n/messages/zh-CN.json")).default;
    case "fr":
      return (await import("@/i18n/messages/fr.json")).default;
    case "ja":
      return (await import("@/i18n/messages/ja.json")).default;
    case "en":
    default:
      return (await import("@/i18n/messages/en.json")).default;
  }
}
