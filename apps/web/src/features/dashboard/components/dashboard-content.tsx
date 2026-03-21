"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import type { TaskFilterState } from "@/features/tasks/components/task-filters";
import { TaskFilters } from "@/features/tasks/components/task-filters";
import { TaskContentCard } from "@/features/tasks/components/task-content-card";
import { TaskDetailOverlay } from "@/features/tasks/components/task-detail-overlay";
import { TaskGanttView } from "@/features/tasks/components/task-gantt-view";
import type { GanttRange } from "@/features/tasks/components/task-gantt-view";
import { TaskListView } from "@/features/tasks/components/task-list-view";
import { TaskStats } from "@/features/tasks/components/task-stats";
import type { ViewMode } from "@/features/tasks/components/view-switcher";
import { ViewSwitcher } from "@/features/tasks/components/view-switcher";
import type { TaskWithClass } from "@/features/tasks/lib/task-utils";
import {
  getDisplayStatus,
  sortTasksByDue,
} from "@/features/tasks/lib/task-utils";
import type { ClassSummary, TaskSummary } from "@/lib/api";
import { listClasses, listClassTasks } from "@/lib/api";

interface DashboardContentProps {
  classId?: string;
  className?: string;
  classColor?: string;
  isOwner?: boolean;
}

export function DashboardContent({
  classId,
  className,
  classColor,
}: DashboardContentProps) {
  const { token } = useAuth();
  const [tasks, setTasks] = useState<TaskWithClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("gantt");
  const [ganttRange, setGanttRange] = useState<GanttRange>("1month");
  const [selectedTask, setSelectedTask] = useState<TaskWithClass | null>(null);
  const [filters, setFilters] = useState<TaskFilterState>({
    unfinished: false,
    notSubmitted: false,
    overdue: false,
    showSubmitted: true,
  });

  const loadTasks = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      if (classId) {
        const data = await listClassTasks(token, classId);
        const tasksWithClass: TaskWithClass[] = data
          .filter((t) => t.isPublished)
          .map((t) => ({
            ...t,
            classColor: classColor ?? "#6366f1",
          }));
        setTasks(sortTasksByDue(tasksWithClass));
      } else {
        const classes = await listClasses(token);
        const allTasks: TaskWithClass[] = [];

        await Promise.all(
          classes.map(async (cls: ClassSummary) => {
            try {
              const classTasks = await listClassTasks(token, cls.id);
              for (const t of classTasks) {
                if (t.isPublished) {
                  allTasks.push({ ...t, classColor: cls.color });
                }
              }
            } catch {
              // Skip failed class
            }
          }),
        );

        setTasks(sortTasksByDue(allTasks));
      }
    } catch {
      // Let empty state handle it
    } finally {
      setLoading(false);
    }
  }, [token, classId, classColor]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (!filters.showSubmitted) {
      result = result.filter((t) => getDisplayStatus(t) !== "submitted");
    }
    if (filters.unfinished) {
      result = result.filter((t) => {
        const s = getDisplayStatus(t);
        return s !== "submitted";
      });
    }
    if (filters.notSubmitted) {
      result = result.filter((t) => getDisplayStatus(t) !== "submitted");
    }
    if (filters.overdue) {
      result = result.filter((t) => getDisplayStatus(t) === "overdue");
    }

    return result;
  }, [tasks, filters]);

  const pageTitle = className ?? "Home";

  const ganttRangeOptions: { value: GanttRange; label: string }[] = [
    { value: "week", label: "Week" },
    { value: "1month", label: "1 Month" },
    { value: "2month", label: "2 Months" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {classColor && (
            <span
              className="inline-block h-3 w-3 rounded-[3px]"
              style={{ backgroundColor: classColor }}
            />
          )}
          <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground">
            {pageTitle}
          </h1>
        </div>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-4">
        <ViewSwitcher value={view} onChange={setView} />
        <TaskFilters filters={filters} onChange={setFilters} />
      </div>

      {/* Stats */}
      <TaskStats tasks={tasks} />

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      ) : (
        <TaskContentCard
          title={view === "list" ? "All Tasks" : undefined}
          headerRight={
            view === "gantt" ? (
              <div className="inline-flex items-center rounded-lg bg-muted p-0.5">
                {ganttRangeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGanttRange(opt.value)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                      ganttRange === opt.value
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : undefined
          }
        >
          {view === "gantt" ? (
            <TaskGanttView
              tasks={filteredTasks}
              range={ganttRange}
              onTaskClick={setSelectedTask}
            />
          ) : (
            <TaskListView
              tasks={filteredTasks}
              showClass={!classId}
              onTaskClick={setSelectedTask}
            />
          )}
        </TaskContentCard>
      )}

      {/* Task detail overlay */}
      {selectedTask && (
        <TaskDetailOverlay
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}
