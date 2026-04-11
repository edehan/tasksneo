"use client";

import { ChevronRight } from "lucide-react";
import { GlobalSearchInput } from "@/components/global-search-input";
import { NotificationBell } from "@/components/notification-bell";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface AppHeaderProps {
  breadcrumbs?: { label: string; href?: string }[];
  children?: React.ReactNode;
}

export function AppHeader({ breadcrumbs, children }: AppHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger className="-ml-1 shrink-0" />
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="hidden min-w-0 items-center gap-1.5 truncate text-sm text-muted-foreground lg:flex">
            {breadcrumbs.map((crumb, i) => (
              <span
                key={crumb.label}
                className="flex min-w-0 items-center gap-1.5"
              >
                {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
                {i === breadcrumbs.length - 1 ? (
                  <span className="truncate font-medium text-foreground">
                    {crumb.label}
                  </span>
                ) : (
                  <span className="truncate">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
      </div>

      <div className="ml-auto min-w-0">
        <GlobalSearchInput />
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2">
        <NotificationBell />
        {children}
      </div>
    </header>
  );
}
