"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, ClipboardList } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { useAuth } from "@/components/auth-provider";
import { ClassColorBadge } from "@/components/class-color-badge";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ClassSummary, TaskSummary } from "@/lib/api";
import { listClasses, listClassTasks } from "@/lib/api";

function getTaskStatus(task: TaskSummary): "unread" | "read" | "submitted" {
  if (!task.userState || !task.userState.viewedAt) return "unread";
  // We don't have submission info in TaskSummary from the list endpoint,
  // so we rely on tags or check separately. For now, use viewedAt as the signal.
  return "read";
}

const statusConfig = {
  unread: { label: "Unread", variant: "default" as const },
  read: { label: "Read", variant: "secondary" as const },
  submitted: { label: "Submitted", variant: "outline" as const },
};

function formatDueDate(dueAt: string | null): string {
  if (!dueAt) return "No due date";
  const date = new Date(dueAt);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return "Overdue";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

interface TaskWithClass extends TaskSummary {
  classColor: string;
}

export default function DashboardPage() {
  const { token } = useAuth();
  const [tasks, setTasks] = useState<TaskWithClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasClasses, setHasClasses] = useState(true);

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
          // Sort: tasks with due dates first (soonest first), then no due date
          if (a.dueAt && b.dueAt) return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
          if (a.dueAt) return -1;
          if (b.dueAt) return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
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

  return (
    <>
      <AppHeader title="Dashboard" />
      <div className="p-6 space-y-6">
        <PageHeader
          title="Dashboard"
          description="All your tasks across classes"
        />

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
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
                <Link href="/classes/join">Join a class</Link>
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
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead className="w-40">Class</TableHead>
                  <TableHead className="w-32">Due</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => {
                  const status = getTaskStatus(task);
                  const cfg = statusConfig[status];
                  return (
                    <TableRow key={task.id}>
                      <TableCell>
                        <Link
                          href={`/classes/${task.classId}/tasks/${task.id}`}
                          className="font-medium hover:underline"
                        >
                          {task.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/classes/${task.classId}`}
                          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                        >
                          <ClassColorBadge color={task.classColor} />
                          <span className="truncate">{task.className}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDueDate(task.dueAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}
