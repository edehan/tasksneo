"use client";

import { Globe } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useAppLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type AppLocale, SUPPORTED_LOCALES } from "@/i18n/locale";
import { updateProfile } from "@/lib/api";

const LOCALE_LABELS: Record<AppLocale, string> = {
  en: "English",
  "zh-CN": "中文",
  fr: "Français",
  ja: "日本語",
};

export function LocaleSwitcher() {
  const { locale, setLocale } = useAppLocale();
  const { user, updateUser } = useAuth();

  async function selectLocale(nextLocale: AppLocale) {
    if (user) {
      try {
        const updated = await updateProfile({ locale: nextLocale });
        updateUser(updated);
      } catch {
        // Keep language switching available even if the profile save fails.
      }
    }

    setLocale(nextLocale);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
        >
          <Globe className="h-4 w-4" />
          <span className="text-xs">{LOCALE_LABELS[locale]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED_LOCALES.map((loc) => (
          <DropdownMenuItem key={loc} onClick={() => void selectLocale(loc)}>
            {LOCALE_LABELS[loc]}
            {locale === loc && (
              <span className="ml-auto text-xs text-muted-foreground">
                &#10003;
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
