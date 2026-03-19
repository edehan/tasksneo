"use client";

import { BookOpen, ChevronDown, ClipboardList } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AppHeader } from "@/components/app-header";
import { useAuth } from "@/components/auth-provider";
import { ClassColorBadge } from "@/components/class-color-badge";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ClassSummary, TaskSummary } from "@/lib/api";
import { listClasses, listClassTasks } from "@/lib/api";

type TaskStatus = "unread" | "read" | "submitted";

function getTaskStatus(task: TaskSummary): TaskStatus {
  // TODO: API does not return submission status in task list yet.
  // For now, derive from userState only. "submitted" will be available
  // once we add submission info to the list endpoint.
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

function isOverdue(task: TaskSummary): boolean {
  if (!task.dueAt) return false;
  return new Date(task.dueAt).getTime() < Date.now();
}

interface TaskWithClass extends TaskSummary {
  classColor: string;
}

function TaskRow({ task }: { task: TaskWithClass }) {
  const status = getTaskStatus(task);
  const cfg = statusConfig[status];
  const due = formatDueDate(task.dueAt);

  return (
    <Link
      href={`/classes/${task.classId}/tasks/${task.id}`}
      className="flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors hover:bg-accent/50"
    >
      <ClassColorBadge color={task.classColor} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{task.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {task.className}
        </p>
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

export default function DashboardPage() {
  const { token } = useAuth();
  const [tasks, setTasks] = useState<TaskWithClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasClasses, setHasClasses] = useState(true);
  const [showOverdue, setShowOverdue] = useState(false);

  const loadAllTasks = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const classes = await listClasses(token);
      const nonPersonal = classes.filter((c) => !c.isPersonal);
      setHasClasses(nonPersonal.length > 0);

      const classMap = new Map<string, ClassSummary>();
      for (const cls of classes) {
        classMap.set(cls.id, cls);
      }

      const results = await Promise.all(
        classes.map((cls) => listClassTasks(token, cls.id)),
      );

      const allTasks: TaskWithClass[] = results
        .flat()
        .map((t) => ({
          ...t,
          classColor: classMap.get(t.classId)?.color ?? "#6366f1",
        }))
        .sort((a, b) => {
          if (a.dueAt && b.dueAt)
            return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
          if (a.dueAt) return -1;
          if (b.dueAt) return 1;
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });

      setTasks(allTasks);
    } catch {
      // Fail silently
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadAllTasks();
  }, [loadAllTasks]);

  const activeTasks = tasks.filter((t) => !isOverdue(t));
  const overdueTasks = tasks.filter((t) => isOverdue(t));

  return (
    <>
      <AppHeader title="Dashboard" />
      <div className="mx-auto max-w-240 p-6 space-y-6">
        <PageHeader
          title="Dashboard"
          description="All your tasks across classes"
        />

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={`skel-${i}`} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : !hasClasses && tasks.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="Welcome to TaskFlow"
            description="Get started by creating a class or joining one with an invite code."
          >
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/classes">Join a class</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/classes/new">Create a class</Link>
              </Button>
            </div>
          </EmptyState>
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No tasks yet"
            description="Tasks from your classes will appear here."
          />
        ) : (
          <div className="space-y-2">
            {activeTasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}

            {overdueTasks.length > 0 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowOverdue(!showOverdue)}
                  className="flex w-full items-center gap-2 rounded-lg px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/50"
                >
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showOverdue ? "rotate-0" : "-rotate-90"}`}
                  />
                  <span>Overdue ({overdueTasks.length})</span>
                </button>
                {showOverdue && (
                  <div className="mt-1 space-y-2 opacity-75">
                    {overdueTasks.map((task) => (
                      <TaskRow key={task.id} task={task} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
