"use client";

import type { TaskWithClass } from "@/features/tasks/lib/task-utils";
import {
  displayStatusConfig,
  formatDateTime,
  getDisplayStatus,
} from "@/features/tasks/lib/task-utils";

interface TaskListViewProps {
  tasks: TaskWithClass[];
  showClass?: boolean;
  onTaskClick?: (task: TaskWithClass) => void;
}

export function TaskListView({
  tasks,
  showClass = true,
  onTaskClick,
}: TaskListViewProps) {
  return (
    <div>
      {/* Header */}
      <div className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_110px] gap-3 border-b border-border px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.06em] text-text-muted">
        <span>Task</span>
        <span>Start Date</span>
        <span>Due Date</span>
        <span>Status</span>
      </div>

      {/* Rows */}
      {tasks.map((task) => {
        const status = getDisplayStatus(task);
        const cfg = displayStatusConfig[status];
        const isSubmitted = status === "submitted";
        const isOverdue = status === "overdue";

        return (
          <div
            key={task.id}
            onClick={() => onTaskClick?.(task)}
            className="grid cursor-pointer grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_110px] items-center gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-[var(--background)]"
          >
            {/* Task name */}
            <div className="flex items-center gap-2.5 min-w-0">
              {showClass && (
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: task.classColor,
                    opacity: isSubmitted ? 0.4 : 1,
                  }}
                />
              )}
              <span
                className={`truncate text-[13px] font-medium ${
                  isSubmitted
                    ? "text-text-muted line-through"
                    : "text-foreground"
                }`}
              >
                {task.title}
              </span>
            </div>

            {/* Start Date */}
            <span className="text-xs text-muted-foreground">
              {formatDateTime(task.startAt)}
            </span>

            {/* Due Date */}
            <span
              className={`text-xs ${
                isOverdue
                  ? "font-semibold text-[#c45c5c]"
                  : "text-muted-foreground"
              }`}
            >
              {formatDateTime(task.dueAt)}
            </span>

            {/* Status pill */}
            <span
              className={`inline-flex w-fit items-center justify-center rounded-md px-2.5 py-1 text-[11px] font-semibold ${cfg.colorClass}`}
            >
              {cfg.label}
            </span>
          </div>
        );
      })}

      {tasks.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No tasks to display.
        </p>
      )}
    </div>
  );
}
