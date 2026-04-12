"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { PageTransition } from "@/components/page-transition";
import { readSafeNextParam } from "@/lib/search-params";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { token, loading } = useAuth();
  const router = useRouter();
  const [next, setNext] = useState<string | null>(null);
  const [searchReady, setSearchReady] = useState(false);

  useEffect(() => {
    setNext(readSafeNextParam());
    setSearchReady(true);
  }, []);

  useEffect(() => {
    if (!loading && token && searchReady) {
      router.replace(next ?? "/dashboard");
    }
  }, [loading, token, router, next, searchReady]);

  if (loading || token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4">
        <LocaleSwitcher />
      </div>
      <PageTransition className="w-full max-w-md">{children}</PageTransition>
    </div>
  );
}
