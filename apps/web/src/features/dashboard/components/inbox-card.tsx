"use client";

import {
  Bell,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  Megaphone,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import type { NotificationItem } from "@/lib/api";
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api";

const STORAGE_KEY = "taskflow_inbox_collapsed";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

interface InboxCardProps {
  onTaskClick?: (taskId: string) => void;
}

export function InboxCard({ onTaskClick }: InboxCardProps) {
  const { token } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await listMyNotifications(token, { limit: 20 });
      setItems(res.items);
      setUnreadCount(res.unreadCount);
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  async function handleMarkAllRead() {
    if (!token) return;
    try {
      await markAllNotificationsRead(token);
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          readAt: item.readAt ?? new Date().toISOString(),
        })),
      );
      setUnreadCount(0);
    } catch {
      // Non-critical
    }
  }

  async function handleClickItem(item: NotificationItem) {
    if (!token) return;

    if (!item.readAt) {
      try {
        await markNotificationRead(token, item.id);
        setItems((prev) =>
          prev.map((n) =>
            n.id === item.id
              ? { ...n, readAt: new Date().toISOString() }
              : n,
          ),
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // Continue even if mark-read fails
      }
    }

    if (item.taskId && onTaskClick) {
      onTaskClick(item.taskId);
    }
  }

  // Don't render at all if no notifications and not loading
  if (!loading && items.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={toggleCollapsed}
          className="flex items-center gap-2 text-sm font-semibold"
        >
          {collapsed ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-heading-md">Inbox</span>
          {unreadCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-medium text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </button>

        {unreadCount > 0 && !collapsed && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground"
            onClick={handleMarkAllRead}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all as read
          </Button>
        )}
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="border-t">
          {loading ? (
            <div className="space-y-1 p-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded-md bg-muted"
                />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void handleClickItem(item)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                >
                  {/* Icon */}
                  <div className="shrink-0">
                    {item.type === "TASK_PUBLISHED" ? (
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
                      {item.taskTitle}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.className}
                    </p>
                  </div>

                  {/* Time + unread dot */}
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(item.createdAt)}
                    </span>
                    {!item.readAt && (
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
