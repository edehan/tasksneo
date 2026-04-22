"use client";

import { NextIntlClientProvider } from "next-intl";

import { AppLocaleProvider } from "@/components/locale-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { PageTransition } from "@/components/page-transition";
import { useClientLocale } from "@/hooks/use-client-locale";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { locale, messages, setLocale } = useClientLocale();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AppLocaleProvider locale={locale} setLocale={setLocale}>
        <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
          <div className="absolute right-4 top-4">
            <LocaleSwitcher />
          </div>
          <PageTransition className="w-full max-w-md">
            {children}
          </PageTransition>
        </div>
      </AppLocaleProvider>
    </NextIntlClientProvider>
  );
}
