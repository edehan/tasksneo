"use client";

import { Bell, BookOpen, CheckCircle, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { PageTransition } from "@/components/page-transition";

const BRANDING_FEATURES = [
  { icon: BookOpen, key: "feature1" },
  { icon: Users, key: "feature2" },
  { icon: CheckCircle, key: "feature3" },
  { icon: Bell, key: "feature4" },
] as const;

function AuthLayoutInner({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const t = useTranslations("authBranding");

  useEffect(() => {
    if (!loading && token) {
      const dest = next && next.startsWith("/") ? next : "/dashboard";
      router.replace(dest);
    }
  }, [loading, token, router, next]);

  if (loading || token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen">
      {/* Left branding panel — desktop only */}
      <div
        className="hidden lg:flex lg:w-[45%] flex-col justify-between border-r border-border p-12
          bg-gradient-to-br from-[#f5f1ea] via-[#f0ece4] to-[#e8e2d8]
          dark:from-[#1e1c1a] dark:via-[#252320] dark:to-[#2a2725]"
      >
        <div>
          <h1 className="text-display">TaskNeo</h1>
        </div>

        <div className="space-y-8">
          <p className="text-heading-lg text-foreground/80">{t("tagline")}</p>
          <ul className="space-y-5">
            {BRANDING_FEATURES.map(({ icon: Icon, key }) => (
              <li
                key={key}
                className="flex items-start gap-3 text-muted-foreground"
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                <span className="text-sm">{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-muted-foreground/60">
          &copy; {new Date().getFullYear()} TaskNeo
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col min-h-screen">
        <div className="flex justify-end p-4">
          <LocaleSwitcher />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-12">
          <PageTransition className="w-full max-w-md">
            {children}
          </PageTransition>
        </div>
      </div>
    </div>
  );
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        </div>
      }
    >
      <AuthLayoutInner>{children}</AuthLayoutInner>
    </Suspense>
  );
}
