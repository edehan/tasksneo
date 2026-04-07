"use client";

import { BookOpen, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { CreateClassDialog } from "@/components/create-class-dialog";
import { Button } from "@/components/ui/button";
import { JoinClassDialog } from "@/features/classes/components/join-class-dialog";
import { FilterBar } from "@/features/dashboard/components/filter-bar";
import { StatCards } from "@/features/dashboard/components/stat-cards";
import { TaskDetailOverlay } from "@/features/tasks/components/task-detail-overlay";
import { TaskGanttView } from "@/features/tasks/components/task-gantt-view";
import { TaskListView } from "@/features/tasks/components/task-list-view";
import {
  type ViewMode,
  ViewSwitcher,
} from "@/features/tasks/components/view-switcher";
import type { TaskWithClass } from "@/features/tasks/lib/task-utils";
import type { ClassSummary } from "@/lib/api";
import { listClasses, listMyTasks } from "@/lib/api";

function deriveDisplayStatus(
  task: TaskWithClass,
): "submitted" | "overdue" | "in-progress" | "not-started" {
  if (task.userState?.submittedAt) return "submitted";
  const now = Date.now();
  const dueAt = task.dueAt ? new Date(task.dueAt).getTime() : null;
  const startAt = task.startAt ? new Date(task.startAt).getTime() : null;
  if (dueAt && dueAt < now) return "overdue";
  if (startAt && startAt <= now && dueAt && dueAt >= now) return "in-progress";
  return "not-started";
}

export function DashboardPage() {
  const t = useTranslations("dashboardPage");
  const { token } = useAuth();
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [tasks, setTasks] = useState<TaskWithClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TaskWithClass | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("gantt");
  const [filters, setFilters] = useState({
    unfinished: false,
    notSubmitted: false,
    overdue: false,
    showSubmitted: false,
  });

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const [classList, myTasks] = await Promise.all([
        listClasses(token),
        listMyTasks(token),
      ]);
      setClasses(classList);
      setTasks(
        myTasks.map((t) => ({
          ...t,
          classColor: t.classColor || "#8B7355",
        })),
      );
    } catch {
      // Failed to load
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const status = deriveDisplayStatus(task);

      // Hide submitted unless "Show Submitted" is active
      if (status === "submitted" && !filters.showSubmitted) return false;

      // If any specific filter is active, only show matching tasks
      const hasActiveFilter =
        filters.unfinished || filters.notSubmitted || filters.overdue;
      if (!hasActiveFilter) return true;

      if (
        filters.unfinished &&
        (status === "in-progress" ||
          status === "not-started" ||
          status === "overdue")
      )
        return true;
      if (filters.notSubmitted && status !== "submitted") return true;
      if (filters.overdue && status === "overdue") return true;

      return false;
    });
  }, [tasks, filters]);

  // Compute stats from ALL tasks (before filtering)
  const stats = useMemo(() => {
    let total = 0;
    let inProgress = 0;
    let overdue = 0;
    let notStarted = 0;
    for (const task of tasks) {
      const s = deriveDisplayStatus(task);
      total++;
      if (s === "in-progress") inProgress++;
      if (s === "overdue") overdue++;
      if (s === "not-started") notStarted++;
    }
    return { total, inProgress, overdue, notStarted };
  }, [tasks]);

  // Class legend for Gantt chart
  const classLegend = useMemo(() => {
    const seen = new Map<string, { name: string; color: string }>();
    for (const t of tasks) {
      if (!seen.has(t.classId)) {
        seen.set(t.classId, { name: t.className, color: t.classColor });
      }
    }
    return Array.from(seen.values());
  }, [tasks]);

  const isEmpty = !loading && tasks.length === 0;

  if (loading) {
    return (
      <div className="p-8 max-w-[960px] mx-auto">
        <div className="h-8 w-48 bg-muted animate-pulse rounded mb-2" />
        <div className="h-4 w-80 bg-muted animate-pulse rounded mb-8" />
        <div className="grid grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder
            <div key={i} className="h-12 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <BookOpen className="h-12 w-12 text-text-muted-soft mb-4" />
        <h2 className="text-heading-lg mb-2">{t("empty.title")}</h2>
        <p className="text-muted-foreground mb-6 max-w-sm">
          {t("empty.description")}
        </p>
        <div className="flex gap-3">
          <JoinClassDialog
            trigger={
              <Button variant="outline">
                <UserPlus className="mr-2 h-4 w-4" />
                {t("empty.joinClass")}
              </Button>
            }
            onJoined={() => void loadData()}
          />
          <CreateClassDialog
            trigger={<Button>{t("empty.createClass")}</Button>}
            onCreated={() => void loadData()}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[960px] mx-auto">
      {/* Title */}
      <h1 className="text-display mb-1">{t("title")}</h1>
      <p className="text-muted-foreground mb-8">{t("subtitle")}</p>

      {/* Controls row */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <ViewSwitcher mode={viewMode} onChange={setViewMode} />
        <FilterBar filters={filters} onChange={setFilters} />
      </div>

      {/* Stat cards */}
      <div className="mb-8">
        <StatCards
          total={stats.total}
          inProgress={stats.inProgress}
          overdue={stats.overdue}
          notStarted={stats.notStarted}
        />
      </div>

      {/* Section heading */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-heading-md">{t("allTasks")}</h2>
      </div>

      {/* Task views */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {viewMode === "gantt" ? (
          <TaskGanttView
            tasks={filteredTasks}
            onTaskClick={setSelectedTask}
          />
        ) : (
          <TaskListView
            tasks={filteredTasks}
            showClass
            onTaskClick={setSelectedTask}
          />
        )}
      </div>

      {/* Task Detail Overlay */}
      {selectedTask && (
        <TaskDetailOverlay
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          isAdmin={(() => {
            const cls = classes.find((c) => c.id === selectedTask.classId);
            return cls?.myRole === "OWNER" || cls?.myRole === "ADMIN";
          })()}
        />
      )}

      {/* Class legend (Gantt mode) */}
      {viewMode === "gantt" && classLegend.length > 0 && (
        <div className="flex items-center gap-4 mt-4 flex-wrap">
          {classLegend.map((c) => (
            <div key={c.name} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: c.color }}
              />
              <span className="text-xs text-muted-foreground">{c.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
