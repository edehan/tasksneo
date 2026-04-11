"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const t = useTranslations("settingsLayout");

  const settingsTabs = [
    { label: t("tabs.profile"), href: "/settings/profile" },
    { label: t("tabs.notifications"), href: "/settings/notifications" },
    { label: t("tabs.account"), href: "/settings/account" },
    { label: t("tabs.sessions"), href: "/settings/sessions" },
    { label: t("tabs.mcpKeys"), href: "/settings/mcp-keys" },
  ];

  return (
    <div className="p-8 max-w-[640px] mx-auto">
      <h1 className="text-display mb-6">{t("title")}</h1>
      <nav className="flex gap-1 border-b border-border mb-8">
        {settingsTabs.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
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
