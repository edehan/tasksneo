import type { Metadata } from "next";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";

import { AuthProvider } from "@/components/auth-provider";
import { resolveLocaleFromAcceptLanguage, toHtmlLang } from "@/i18n/locale";
import { getMessagesForLocale } from "@/i18n/messages";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

export const metadata: Metadata = {
  title: "TaskFlow",
  description: "TaskFlow frontend",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const locale = resolveLocaleFromAcceptLanguage(
    headerStore.get("accept-language"),
  );
  const messages = await getMessagesForLocale(locale);

  return (
    <html lang={toHtmlLang(locale)} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased text-sm leading-relaxed">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
            <AuthProvider>
              {children}
              <Toaster richColors position="top-right" />
            </AuthProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
