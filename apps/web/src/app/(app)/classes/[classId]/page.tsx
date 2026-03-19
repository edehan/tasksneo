"use client";

import { ClipboardList, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AppHeader } from "@/components/app-header";
import { useAuth } from "@/components/auth-provider";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskBoardView } from "@/features/tasks/components/task-board-view";
import { TaskCalendarView } from "@/features/tasks/components/task-calendar-view";
import { TaskGanttView } from "@/features/tasks/components/task-gantt-view";
import { TaskListView } from "@/features/tasks/components/task-list-view";
import {
  type ViewMode,
  ViewSwitcher,
} from "@/features/tasks/components/view-switcher";
import type { TaskWithClass } from "@/features/tasks/lib/task-utils";
import { sortTasksByDue } from "@/features/tasks/lib/task-utils";
import type { ClassSummary } from "@/lib/api";
import { getClass, listClassTasks } from "@/lib/api";

export default function ClassDetailPage() {
  const { token } = useAuth();
  const params = useParams<{ classId: string }>();
  const classId = params.classId;

  const [cls, setCls] = useState<ClassSummary | null>(null);
  const [tasks, setTasks] = useState<TaskWithClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("list");

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
        sortTasksByDue(
          taskData.map((t) => ({
            ...t,
            classColor: classData.color ?? "#6366f1",
          })),
        ),
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
      <div className="mx-auto max-w-240 space-y-6 p-6">
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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
              {tasks.length > 0 && (
                <ViewSwitcher value={view} onChange={setView} />
              )}
            </div>

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
              <>
                {view === "list" && (
                  <TaskListView tasks={tasks} showClass={false} />
                )}
                {view === "board" && (
                  <TaskBoardView tasks={tasks} showClass={false} />
                )}
                {view === "gantt" && <TaskGanttView tasks={tasks} />}
                {view === "calendar" && <TaskCalendarView tasks={tasks} />}
              </>
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
