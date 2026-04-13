import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { PageTransition } from "@/components/page-transition";
import { SWRProvider } from "@/components/swr-provider";
import { TimezonePrompt } from "@/components/timezone-prompt";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { GlobalSearchProvider } from "@/features/search/global-search";
import { getServerClasses } from "@/lib/server-api";
import { webDataKeys } from "@/lib/web-data-keys";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const classes = await getServerClasses();

  return (
    <SidebarProvider>
      <SWRProvider
        fallbackEntries={[{ key: webDataKeys.classes(), data: classes }]}
      >
        <GlobalSearchProvider initialClasses={classes}>
          <AppSidebar initialClasses={classes} />
          <SidebarInset>
            <AppHeader />
            <TimezonePrompt />
            <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
              <PageTransition>{children}</PageTransition>
            </main>
          </SidebarInset>
        </GlobalSearchProvider>
      </SWRProvider>
    </SidebarProvider>
  );
}
