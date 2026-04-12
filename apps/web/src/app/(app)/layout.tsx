"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/components/auth-provider";
import { PageTransition } from "@/components/page-transition";
import { TimezonePrompt } from "@/components/timezone-prompt";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { GlobalSearchProvider } from "@/features/search/global-search";
import { useClassAccent } from "@/hooks/use-class-accent";
import { buildLoginHref } from "@/lib/auth-redirect";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Set class accent color based on current route
  useClassAccent();

  useEffect(() => {
    if (!loading && !token) {
      const query = searchParams.toString();
      const next = `${pathname}${query ? `?${query}` : ""}`;
      router.replace(buildLoginHref(next));
    }
  }, [loading, token, pathname, router, searchParams]);

  if (loading || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <GlobalSearchProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <TimezonePrompt />
          <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
            <PageTransition>{children}</PageTransition>
          </main>
        </SidebarInset>
      </GlobalSearchProvider>
    </SidebarProvider>
  );
}
