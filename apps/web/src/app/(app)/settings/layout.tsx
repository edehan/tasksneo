"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/account", label: "Account" },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <>
      <AppHeader title="Settings" />
      <div className="mx-auto max-w-160 p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:gap-10">
          {/* Side nav */}
          <nav className="flex shrink-0 gap-1 sm:w-44 sm:flex-col">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent/50",
                  pathname === item.href
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Content */}
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </>
  );
}
