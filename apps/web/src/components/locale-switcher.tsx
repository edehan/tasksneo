"use client";

import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppLocale } from "@/components/locale-provider";
import { SUPPORTED_LOCALES, type AppLocale } from "@/i18n/locale";

const LOCALE_LABELS: Record<AppLocale, string> = {
  en: "English",
  "zh-CN": "中文",
  fr: "Français",
  ja: "日本語",
};

export function LocaleSwitcher() {
  const { locale, setLocale } = useAppLocale();

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
          <DropdownMenuItem
            key={loc}
            onClick={() => setLocale(loc)}
          >
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
