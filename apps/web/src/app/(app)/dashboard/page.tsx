"use client";

import { BookOpen, ClipboardList } from "lucide-react";
import Link from "next/link";
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
import { listClasses, listClassTasks } from "@/lib/api";

export default function DashboardPage() {
  const { token } = useAuth();
  const [tasks, setTasks] = useState<TaskWithClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasClasses, setHasClasses] = useState(true);
  const [view, setView] = useState<ViewMode>("list");

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

      const allTasks: TaskWithClass[] = sortTasksByDue(
        results.flat().map((t) => ({
          ...t,
          classColor: classMap.get(t.classId)?.color ?? "#6366f1",
        })),
      );

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
      <div className="mx-auto max-w-240 space-y-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <PageHeader
            title="Dashboard"
            description="All your tasks across classes"
          />
          {!loading && tasks.length > 0 && (
            <ViewSwitcher value={view} onChange={setView} />
          )}
        </div>

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
          <>
            {view === "list" && <TaskListView tasks={tasks} />}
            {view === "board" && <TaskBoardView tasks={tasks} />}
            {view === "gantt" && <TaskGanttView tasks={tasks} />}
            {view === "calendar" && <TaskCalendarView tasks={tasks} />}
          </>
        )}
      </div>
    </>
  );
}
