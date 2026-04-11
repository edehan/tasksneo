"use client";

import { Plus, Settings, Users } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
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
import type { ClassSummary } from "@/lib/api";
import { getClass, listClassTasks, listMembers } from "@/lib/api";

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

export function ClassPage() {
  const t = useTranslations("classPage");
  const params = useParams();
  const router = useRouter();
  const { token, user } = useAuth();
  const classId = params?.classId as string;

  const [cls, setCls] = useState<ClassSummary | null>(null);
  const [tasks, setTasks] = useState<TaskWithClass[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TaskWithClass | null>(null);
  const [postTaskOpen, setPostTaskOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("gantt");
  const [dayWidth, setDayWidth] = useState(DEFAULT_DAY_WIDTH);
  const [filters, setFilters] = useState({
    unfinished: false,
    notSubmitted: false,
    overdue: false,
    showSubmitted: false,
  });

  const loadData = useCallback(async () => {
    if (!token || !classId) return;
    try {
      const [classData, classTasks, members] = await Promise.all([
        getClass(token, classId),
        listClassTasks(token, classId),
        listMembers(token, classId),
      ]);
      setCls(classData);
      setTasks(
        classTasks.map(
          (t) =>
            ({
              ...t,
              className: classData.name,
              classColor: classData.color || "#8B7355",
            }) as TaskWithClass,
        ),
      );
      // Find current user's role
      const me = members.find((m) => m.userId === user?.id);
      setMyRole(me?.role || null);
    } catch {
      // Failed to load
    } finally {
      setLoading(false);
    }
  }, [token, classId, user?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const isAdmin = myRole === "OWNER" || myRole === "ADMIN";

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const status = deriveDisplayStatus(task);
      if (status === "submitted" && !filters.showSubmitted) return false;
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

  if (loading) {
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
            void loadData();
            router.push(`/tasks/${taskId}/edit`);
          }}
        />
      )}
    </div>
  );
}
