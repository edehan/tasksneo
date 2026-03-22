"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const settingsTabs = [
  { label: "Profile", href: "/settings/profile" },
  { label: "Notifications", href: "/settings/notifications" },
  { label: "Account", href: "/settings/account" },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="p-8 max-w-[640px] mx-auto">
      <h1 className="text-display mb-6">Settings</h1>
      <nav className="flex gap-1 border-b border-border mb-8">
        {settingsTabs.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors relative",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full" />
              )}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
