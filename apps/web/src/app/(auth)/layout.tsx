"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { PageTransition } from "@/components/page-transition";
import { normalizeNextPath } from "@/lib/auth-redirect";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { token, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!loading && token) {
      router.replace(normalizeNextPath(searchParams.get("next")));
    }
  }, [loading, token, router, searchParams]);

  if (loading || token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="absolute top-4 right-4">
        <LocaleSwitcher />
      </div>
      <PageTransition className="w-full max-w-md">{children}</PageTransition>
    </div>
  );
}
