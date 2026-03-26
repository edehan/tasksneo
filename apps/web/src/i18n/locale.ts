export const SUPPORTED_LOCALES = ["en", "zh-CN", "fr", "ja"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en";

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/_/g, "-");
}

export function matchLocaleTag(tag: string | null | undefined): AppLocale | null {
  if (!tag) return null;

  const normalized = normalizeTag(tag);
  if (!normalized) return null;

  // Fuzzy Chinese match: zh, zh-Hant, zh-TW, zh-HK, zh-SG ...
  // First release only ships Simplified Chinese, so all Chinese variants map to zh-CN.
  if (normalized.startsWith("zh")) return "zh-CN";

  // Fuzzy English match: en, en-AU, en-GB ...
  if (normalized.startsWith("en")) return "en";

  // Fuzzy French match: fr, fr-CA, fr-FR ...
  if (normalized.startsWith("fr")) return "fr";

  // Fuzzy Japanese match: ja, ja-JP ...
  if (normalized.startsWith("ja")) return "ja";

  return null;
}

export function parseAcceptLanguage(headerValue: string | null | undefined): string[] {
  if (!headerValue) return [];

  return headerValue
    .split(",")
    .map((part, index) => {
      const [rawTag, ...params] = part.split(";");
      const tag = rawTag?.trim();
      if (!tag) return null;

      let q = 1;
      for (const param of params) {
        const normalized = param.trim().toLowerCase();
        if (normalized.startsWith("q=")) {
          const parsed = Number(normalized.slice(2));
          if (!Number.isNaN(parsed)) {
            q = parsed;
          }
        }
      }

      return { tag, q, index };
    })
    .filter((item): item is { tag: string; q: number; index: number } => item !== null)
    .sort((a, b) => b.q - a.q || a.index - b.index)
    .map((item) => item.tag);
}

export function resolvePreferredLocale(
  languageTags: readonly string[] | null | undefined,
): AppLocale {
  if (!languageTags || languageTags.length === 0) {
    return DEFAULT_LOCALE;
  }

  for (const tag of languageTags) {
    const matched = matchLocaleTag(tag);
    if (matched) return matched;
  }

  return DEFAULT_LOCALE;
}

export function resolveLocaleFromAcceptLanguage(
  headerValue: string | null | undefined,
): AppLocale {
  return resolvePreferredLocale(parseAcceptLanguage(headerValue));
}

export function toHtmlLang(locale: AppLocale): string {
  return locale;
}
