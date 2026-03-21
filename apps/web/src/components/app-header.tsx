"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface BreadcrumbSegment {
  label: string;
  href?: string;
}

interface AppHeaderProps {
  segments?: BreadcrumbSegment[];
  children?: React.ReactNode;
}

export function AppHeader({ segments, children }: AppHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
      <SidebarTrigger className="-ml-1 md:hidden" />
      {segments && segments.length > 0 && (
        <Breadcrumb>
          <BreadcrumbList>
            {segments.map((seg, i) => {
              const isLast = i === segments.length - 1;
              return (
                <span key={seg.label} className="contents">
                  {i > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage
                        className="font-semibold"
                        style={{ color: "var(--class-accent)" }}
                      >
                        {seg.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        href={seg.href ?? "#"}
                        className="text-muted-foreground"
                      >
                        {seg.label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </span>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      )}
      {children && (
        <div className="ml-auto flex items-center gap-2">{children}</div>
      )}
    </header>
  );
}
