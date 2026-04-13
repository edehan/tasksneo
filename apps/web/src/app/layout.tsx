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

function normalizeInstrumentationSnippet(
  value: string | undefined,
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const scriptWrapped = trimmed.match(/^<script[^>]*>([\s\S]*)<\/script>$/i);
  if (scriptWrapped) {
    const inner = scriptWrapped[1]?.trim();
    return inner || null;
  }

  return trimmed;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = (await getLocale()) as AppLocale;
  const messages = await getMessages();
  const user = await getServerUser();
  const cookieStore = await cookies();
  const hasSessionCookie = Boolean(cookieStore.get("tfses_session")?.value);
  const instrumentationSnippet = normalizeInstrumentationSnippet(
    process.env.INSTRUMENTATION_SNIPPET,
  );

  return (
    <html lang={toHtmlLang(locale)} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased text-sm leading-relaxed">
        <Script src="/register-sw.js" strategy="afterInteractive" />
        {instrumentationSnippet && (
          <Script id="instrumentation-snippet" strategy="afterInteractive">
            {instrumentationSnippet}
          </Script>
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
