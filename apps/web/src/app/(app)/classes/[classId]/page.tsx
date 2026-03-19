"use client";

import { ClipboardList, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AppHeader } from "@/components/app-header";
import { useAuth } from "@/components/auth-provider";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ClassSummary, TaskSummary } from "@/lib/api";
import { getClass, listClassTasks } from "@/lib/api";

type TaskStatus = "unread" | "read" | "submitted";

function getTaskStatus(task: TaskSummary): TaskStatus {
  if (task.userState?.viewedAt) return "read";
  return "unread";
}

const statusConfig: Record<TaskStatus, { label: string; className: string }> = {
  unread: {
    label: "Unread",
    className: "bg-secondary text-secondary-foreground border-transparent",
  },
  read: {
    label: "Read",
    className: "bg-status-info/10 text-status-info border-transparent",
  },
  submitted: {
    label: "Submitted",
    className: "bg-status-success/10 text-status-success border-transparent",
  },
};

function formatDueDate(dueAt: string | null): {
  text: string;
  urgent: boolean;
} {
  if (!dueAt) return { text: "No due date", urgent: false };
  const date = new Date(dueAt);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return { text: "Overdue", urgent: true };
  if (days === 0) return { text: "Due today", urgent: true };
  if (days === 1) return { text: "Due tomorrow", urgent: false };
  return {
    text: date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    }),
    urgent: false,
  };
}

function TaskRow({ task, classId }: { task: TaskSummary; classId: string }) {
  const status = getTaskStatus(task);
  const cfg = statusConfig[status];
  const due = formatDueDate(task.dueAt);

  return (
    <Link
      href={`/classes/${classId}/tasks/${task.id}`}
      className="flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors hover:bg-accent/50"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{task.title}</p>
      </div>
      <span
        className={`shrink-0 text-xs ${due.urgent ? "font-medium text-status-error" : "text-muted-foreground"}`}
      >
        {due.text}
      </span>
      <Badge variant="outline" className={`shrink-0 text-xs ${cfg.className}`}>
        {cfg.label}
      </Badge>
    </Link>
  );
}

export default function ClassDetailPage() {
  const { token } = useAuth();
  const params = useParams<{ classId: string }>();
  const classId = params.classId;

  const [cls, setCls] = useState<ClassSummary | null>(null);
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [classData, taskData] = await Promise.all([
        getClass(token, classId),
        listClassTasks(token, classId),
      ]);
      setCls(classData);
      setTasks(
        taskData.sort((a, b) => {
          if (a.dueAt && b.dueAt)
            return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
          if (a.dueAt) return -1;
          if (b.dueAt) return 1;
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        }),
      );
    } catch {
      // Handled by empty state
    } finally {
      setLoading(false);
    }
  }, [token, classId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Set class accent color
  useEffect(() => {
    if (cls?.color) {
      document.documentElement.style.setProperty("--class-accent", cls.color);
      return () => {
        document.documentElement.style.removeProperty("--class-accent");
      };
    }
  }, [cls?.color]);

  const isAdmin = cls?.myRole === "OWNER" || cls?.myRole === "ADMIN";

  return (
    <>
      <AppHeader title={cls?.name ?? "Class"} />
      <div className="mx-auto max-w-240 p-6 space-y-6">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-5 w-64" />
            <div className="space-y-3 pt-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton
                  key={`task-skeleton-${i}`}
                  className="h-14 w-full rounded-lg"
                />
              ))}
            </div>
          </div>
        ) : cls ? (
          <>
            <PageHeader
              title={cls.name}
              description={cls.description ?? undefined}
            >
              {isAdmin && (
                <>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/classes/${classId}/settings`}>
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href={`/classes/${classId}/tasks/new`}>
                      <Plus className="mr-2 h-4 w-4" />
                      Publish task
                    </Link>
                  </Button>
                </>
              )}
            </PageHeader>

            {tasks.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No tasks yet"
                description={
                  isAdmin
                    ? "Publish a task for your class members."
                    : "Your teacher hasn't published any tasks yet."
                }
              >
                {isAdmin && (
                  <Button asChild size="sm">
                    <Link href={`/classes/${classId}/tasks/new`}>
                      <Plus className="mr-2 h-4 w-4" />
                      Publish task
                    </Link>
                  </Button>
                )}
              </EmptyState>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => (
                  <TaskRow key={task.id} task={task} classId={classId} />
                ))}
              </div>
            )}
          </>
        ) : (
          <EmptyState
            title="Class not found"
            description="This class may have been deleted or you don't have access."
          />
        )}
      </div>
    </>
  );
}
