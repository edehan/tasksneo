import type { Metadata } from "next";
import { cookies } from "next/headers";
import Script from "next/script";
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

function parseInstrumentationScriptUrls(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = (await getLocale()) as AppLocale;
  const messages = await getMessages();
  const cookieStore = await cookies();
  const hasSessionCookie = Boolean(cookieStore.get("tfses_session")?.value);
  const user = hasSessionCookie ? await getServerUser() : null;
  const instrumentationScriptUrls = parseInstrumentationScriptUrls(
    process.env.INSTRUMENTATION_SCRIPT_URLS,
  );

  return (
    <html lang={toHtmlLang(locale)} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased text-sm leading-relaxed">
        <Script src="/register-sw.js" strategy="afterInteractive" />
        {instrumentationScriptUrls.length > 0 && (
          <Script
            id="instrumentation-loader"
            src="/instrumentation-loader.js"
            strategy="afterInteractive"
            data-urls={instrumentationScriptUrls.join(",")}
          />
        )}
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
            <LocaleProvider>
              <AuthProvider
                initialUser={user}
                initialHasSessionCookie={hasSessionCookie}
              >
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
