"use client";

import type { TaskWithClass } from "@/features/tasks/lib/task-utils";

// ─── Status derivation ──────────────────────────────────────────────────────

type DerivedStatus = "submitted" | "overdue" | "in-progress" | "not-started";

function deriveStatus(task: TaskWithClass): DerivedStatus {
  if (task.userState?.submittedAt) return "submitted";
  const now = Date.now();
  const dueAt = task.dueAt ? new Date(task.dueAt).getTime() : null;
  const startAt = task.startAt ? new Date(task.startAt).getTime() : null;
  if (dueAt && dueAt < now) return "overdue";
  if (startAt && startAt <= now && dueAt && dueAt >= now) return "in-progress";
  return "not-started";
}

// ─── Date formatting ────────────────────────────────────────────────────────

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function formatDate(iso: string | null): string {
  if (!iso) return "\u2014";
  return dateFormatter.format(new Date(iso));
}

// ─── Status badge config ────────────────────────────────────────────────────

function getStatusBadge(
  status: DerivedStatus,
  classColor: string,
): { label: string; bg: string; text: string } {
  switch (status) {
    case "submitted":
      return { label: "Submitted", bg: "#5B8C6A18", text: "#5B8C6A" };
    case "overdue":
      return { label: "Overdue", bg: "#c45c5c18", text: "#c45c5c" };
    case "in-progress":
      return { label: "In Progress", bg: classColor + "18", text: classColor };
    case "not-started":
      return { label: "Not Started", bg: "var(--muted)", text: "var(--muted-foreground)" };
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

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
    <div className="w-full">
      {/* Header row */}
      <div
        className="grid items-center border-b border-border px-4 pb-2"
        style={{
          gridTemplateColumns: "minmax(0,2.2fr) minmax(0,1fr) minmax(0,1fr) 110px",
        }}
      >
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Task
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Start Date
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Due Date
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Status
        </span>
      </div>

      {/* Data rows */}
      {tasks.map((task) => {
        const status = deriveStatus(task);
        const badge = getStatusBadge(status, task.classColor);
        const isSubmitted = status === "submitted";
        const isOverdue = status === "overdue";

        return (
          <div
            key={task.id}
            className="grid h-12 cursor-pointer items-center border-b border-border px-4 transition-colors duration-150 hover:bg-surface-subtle"
            style={{
              gridTemplateColumns: "minmax(0,2.2fr) minmax(0,1fr) minmax(0,1fr) 110px",
            }}
            onClick={() => onTaskClick?.(task)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onTaskClick?.(task);
              }
            }}
          >
            {/* Task name + class dot */}
            <div className="flex min-w-0 items-center gap-2">
              {showClass && (
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: task.classColor }}
                />
              )}
              <span
                className={`truncate text-[13px] font-medium ${
                  isSubmitted
                    ? "line-through text-muted-foreground/40"
                    : "text-foreground"
                }`}
              >
                {task.title}
              </span>
            </div>

            {/* Start Date */}
            <span className="text-xs text-muted-foreground">
              {formatDate(task.startAt)}
            </span>

            {/* Due Date */}
            <span
              className={`text-xs ${
                isOverdue
                  ? "font-semibold text-[#c45c5c]"
                  : "text-muted-foreground"
              }`}
            >
              {formatDate(task.dueAt)}
            </span>

            {/* Status badge */}
            <div>
              <span
                className="inline-block rounded-md text-[11px] font-semibold"
                style={{
                  backgroundColor: badge.bg,
                  color: badge.text,
                  padding: "4px 10px",
                }}
              >
                {badge.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
