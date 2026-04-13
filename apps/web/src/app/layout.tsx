import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import { AuthProvider } from "@/components/auth-provider";
import { LocaleProvider } from "@/components/locale-provider";
import { RouteAwareToaster } from "@/components/route-aware-toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { type AppLocale, toHtmlLang } from "@/i18n/locale";
import { getServerUser } from "@/lib/server-api";

import "./globals.css";

export const metadata: Metadata = {
  title: "TaskNeo",
  description: "TaskNeo frontend",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TaskNeo",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = (await getLocale()) as AppLocale;
  const messages = await getMessages();
  const initialUser = await getServerUser();

  return (
    <html lang={toHtmlLang(locale)} suppressHydrationWarning>
      <head>
        <script src="/register-sw.js" />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased text-sm leading-relaxed">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
            <LocaleProvider>
              <AuthProvider initialUser={initialUser}>
                {children}
                <RouteAwareToaster />
              </AuthProvider>
            </LocaleProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
