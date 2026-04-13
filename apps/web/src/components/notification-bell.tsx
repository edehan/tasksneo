"use client";

import { Bell, Clock, Info, Megaphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { NotificationItem } from "@/lib/api";
import {
  getUnreadNotificationCount,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead } from "@/lib/api";

const POLL_INTERVAL = 60_000;

function timeAgo(
  dateStr: string,
  t: ReturnType<typeof useTranslations>,
): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return t("time.justNow");
  if (minutes < 60) return t("time.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("time.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t("time.daysAgo", { count: days });
  return t("time.monthsAgo", { count: Math.floor(days / 30) });
}

export function NotificationBell() {
  const { user } = useAuth();
  const t = useTranslations("notificationBell");
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCount = useCallback(async () => {
    try {
      const res = await getUnreadNotificationCount();
      setUnreadCount(res.unreadCount);
    } catch {
      // Silently fail — badge is non-critical
    }
  }, []);

  // Poll unread count
  useEffect(() => {
    void fetchCount();
    intervalRef.current = setInterval(() => void fetchCount(), POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchCount]);

  // Fetch items when popover opens
  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    listMyNotifications({ limit: 10 })
      .then((res) => {
        setItems(res.items);
        setUnreadCount(res.unreadCount);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          readAt: item.readAt ?? new Date().toISOString() })),
      );
      setUnreadCount(0);
    } catch {
      // Silently fail
    }
  }

  async function handleClickItem(item: NotificationItem) {

    if (!item.readAt) {
      try {
        await markNotificationRead(item.id);
        setItems((prev) =>
          prev.map((n) =>
            n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n,
          ),
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // Continue navigation even if mark-read fails
      }
    }

    setOpen(false);
    if (item.type !== "SITE_ANNOUNCEMENT") {
      router.push("/dashboard");
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">{t("notifications")}</h3>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("markAllAsRead")}
            </button>
          )}
        </div>

        {/* Items */}
        <ScrollArea className="max-h-[360px]">
          {loading ? (
            <div className="space-y-1 p-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder
                  key={i}
                  className="h-14 animate-pulse rounded-md bg-muted"
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Bell className="mb-2 h-5 w-5 text-text-muted-soft" />
              <p className="text-sm">{t("noNotificationsYet")}</p>
            </div>
          ) : (
            <div className="p-1">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void handleClickItem(item)}
                  className="flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                >
                  {/* Icon */}
                  <div className="mt-0.5 shrink-0">
                    {item.type === "SITE_ANNOUNCEMENT" ? (
                      <Info className="h-4 w-4 text-amber-500" />
                    ) : item.type === "TASK_PUBLISHED" ? (
                      <Megaphone className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm ${!item.readAt ? "font-medium text-foreground" : "text-muted-foreground"}`}
                    >
                      {item.type === "SITE_ANNOUNCEMENT"
                        ? (item.title ?? t("systemAnnouncement"))
                        : item.taskTitle}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.type === "SITE_ANNOUNCEMENT"
                        ? t("systemAnnouncement")
                        : item.className}{" "}
                      &middot; {timeAgo(item.createdAt, t)}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {!item.readAt && (
                    <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t px-4 py-2.5 text-center">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/dashboard");
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("viewAllNotifications")}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
