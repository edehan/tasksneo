"use client";

import { Plus, Settings, Users } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useSWRConfig } from "swr";

import { Button } from "@/components/ui/button";
import { FilterBar } from "@/features/dashboard/components/filter-bar";
import { StatCards } from "@/features/dashboard/components/stat-cards";
import { PostTaskDialog } from "@/features/tasks/components/post-task-dialog";
import { TaskDetailOverlay } from "@/features/tasks/components/task-detail-overlay";
import {
  DEFAULT_DAY_WIDTH,
  GanttZoomSlider,
  TaskGanttView,
} from "@/features/tasks/components/task-gantt-view";
import { TaskListView } from "@/features/tasks/components/task-list-view";
import {
  type ViewMode,
  ViewSwitcher,
} from "@/features/tasks/components/view-switcher";
import type { TaskWithClass } from "@/features/tasks/lib/task-utils";
import type { ClassSummary, TaskSummary } from "@/lib/api";
import { useClassQuery, useClassTasksQuery } from "@/lib/web-data";
import { webDataKeys } from "@/lib/web-data-keys";

function deriveDisplayStatus(
  task: TaskWithClass,
): "submitted" | "long-overdue" | "overdue" | "in-progress" | "not-started" {
  if (task.userState?.submittedAt) return "submitted";
  const now = Date.now();
  const dueAt = task.dueAt ? new Date(task.dueAt).getTime() : null;
  const startAt = task.startAt ? new Date(task.startAt).getTime() : null;
  if (dueAt && dueAt < now) {
    if (now - dueAt > 30 * 24 * 60 * 60 * 1000) return "long-overdue";
    return "overdue";
  }
  if (startAt && startAt <= now && dueAt && dueAt >= now) return "in-progress";
  return "not-started";
}

interface ClassPageProps {
  initialClass: ClassSummary | null;
  initialTasks: TaskSummary[];
}

export function ClassPage({ initialClass, initialTasks }: ClassPageProps) {
  const t = useTranslations("classPage");
  const params = useParams();
  const router = useRouter();
  const { mutate: globalMutate } = useSWRConfig();
  const classId = params?.classId as string;

  const [selectedTask, setSelectedTask] = useState<TaskWithClass | null>(null);
  const [postTaskOpen, setPostTaskOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("gantt");
  const [dayWidth, setDayWidth] = useState(DEFAULT_DAY_WIDTH);
  const [filters, setFilters] = useState({
    notSubmitted: false,
    overdue: false,
    showSubmitted: false,
    showLongOverdue: false,
  });
  const {
    data: cls,
    isLoading: classLoading,
    mutate: mutateClass,
  } = useClassQuery(classId, {
    fallbackData: initialClass ?? undefined,
  });
  const {
    data: classTasks = initialTasks,
    isLoading: tasksLoading,
    mutate: mutateClassTasks,
  } = useClassTasksQuery(classId, {
    fallbackData: initialTasks,
  });

  // Revalidate on mount so that returning via router.back always shows fresh data.
  // Without this, navigating back from /tasks/[id]/edit after publishing a task
  // shows stale data because the SWR cache may have been invalidated while
  // this component was unmounted.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally mount-only
  useEffect(() => {
    void mutateClassTasks();
    void mutateClass();
  }, []);
  const tasks = useMemo(
    () =>
      cls
        ? classTasks.map(
            (task) =>
              ({
                ...task,
                className: cls.name,
                classColor: cls.color || "#8B7355",
              }) as TaskWithClass,
          )
        : [],
    [classTasks, cls],
  );
  const isLoading = classLoading || tasksLoading;
  const isAdmin = cls?.myRole === "OWNER" || cls?.myRole === "ADMIN";

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const status = deriveDisplayStatus(task);
      if (status === "submitted" && !filters.showSubmitted) return false;
      if (status === "long-overdue" && !filters.showLongOverdue) return false;

      const hasActiveFilter =
        filters.notSubmitted || filters.overdue;
      if (!hasActiveFilter) return true;
      if (filters.notSubmitted && status !== "submitted") return true;
      if (filters.overdue && (status === "overdue" || status === "long-overdue"))
        return true;
      return false;
    });
  }, [tasks, filters]);

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

  if (isLoading) {
    return (
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
        <div className="h-10 w-64 bg-muted animate-pulse rounded mb-8" />
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder
            <div key={i} className="h-12 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!cls) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">{t("classNotFound")}</p>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
      {/* Title + Post Task */}
      <div className="mb-8 flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="h-3 w-3 rounded-sm shrink-0"
            style={{ backgroundColor: cls.color || "#8B7355" }}
          />
          <h1 className="min-w-0 break-words text-display">{cls.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:shrink-0 xl:justify-end">
          <button
            type="button"
            onClick={() => router.push(`/classes/${classId}/members`)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-foreground"
            title={t("members")}
          >
            <Users size={16} strokeWidth={2} />
          </button>
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => router.push(`/classes/${classId}/settings`)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-foreground"
                title={t("settings")}
              >
                <Settings size={16} strokeWidth={2} />
              </button>
              <Button
                onClick={() => setPostTaskOpen(true)}
                style={{ backgroundColor: cls.color || "#8B7355" }}
                className="text-white hover:opacity-90"
              >
                <Plus className="mr-2 h-4 w-4" />
                {t("postTask")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Controls row */}
      <div className="mb-6 grid min-w-0 gap-3 xl:grid-cols-[auto_minmax(0,1fr)] xl:items-center">
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

      {/* Section heading + zoom slider */}
      <div className="mb-4 flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-heading-md">
          {t("classTasks", { className: cls.name })}
        </h2>
        {viewMode === "gantt" && (
          <GanttZoomSlider dayWidth={dayWidth} onDayWidthChange={setDayWidth} />
        )}
      </div>

      {/* Task views */}
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground mb-2">{t("empty.noTasks")}</p>
          {isAdmin && (
            <Button variant="outline" onClick={() => setPostTaskOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t("empty.postFirstTask")}
            </Button>
          )}
        </div>
      ) : (
        <div className="w-full min-w-0 max-w-full rounded-lg border border-border bg-card overflow-hidden">
          {viewMode === "gantt" ? (
            <TaskGanttView
              tasks={filteredTasks}
              dayWidth={dayWidth}
              onDayWidthChange={setDayWidth}
              onTaskClick={setSelectedTask}
            />
          ) : (
            <TaskListView
              tasks={filteredTasks}
              showClass={false}
              onTaskClick={setSelectedTask}
            />
          )}
        </div>
      )}

      {/* Task Detail Overlay */}
      {selectedTask && (
        <TaskDetailOverlay
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          isAdmin={isAdmin}
        />
      )}

      {/* Post Task Dialog */}
      {isAdmin && (
        <PostTaskDialog
          classId={classId}
          className={cls.name}
          themeColor={cls.color || "#8B7355"}
          open={postTaskOpen}
          onOpenChange={setPostTaskOpen}
          onEditBody={({ taskId }) => {
            void Promise.all([
              mutateClass(),
              mutateClassTasks(),
              globalMutate(webDataKeys.myTasks()),
            ]);
            router.push(`/tasks/${taskId}/edit`);
          }}
        />
      )}
    </div>
  );
}
