"use client";

import { ChevronRight } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface AppHeaderProps {
  breadcrumbs?: { label: string; href?: string }[];
  children?: React.ReactNode;
}

export function AppHeader({ breadcrumbs, children }: AppHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.label} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              {i === breadcrumbs.length - 1 ? (
                <span className="text-foreground font-medium">
                  {crumb.label}
                </span>
              ) : (
                <span>{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      {children && (
        <div className="ml-auto flex items-center gap-2">{children}</div>
      )}
    </header>
  );
}
