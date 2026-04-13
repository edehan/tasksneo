"use client";

import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { PageTransition } from "@/components/page-transition";
import { TimezonePrompt } from "@/components/timezone-prompt";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { GlobalSearchProvider } from "@/features/search/global-search";
import { useClassAccent } from "@/hooks/use-class-accent";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // Set class accent color based on current route
  useClassAccent();

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
