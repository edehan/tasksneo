"use client";

import Link from "next/link";

import { ClassColorBadge } from "@/components/class-color-badge";
import type {
  TaskStatus,
  TaskWithClass,
} from "@/features/tasks/lib/task-utils";
import {
  formatDueDate,
  getTaskStatus,
  statusConfig,
} from "@/features/tasks/lib/task-utils";

const columns: { status: TaskStatus; label: string }[] = [
  { status: "unread", label: "Unread" },
  { status: "read", label: "Read" },
  { status: "submitted", label: "Submitted" },
];

function TaskCard({
  task,
  showClass,
}: {
  task: TaskWithClass;
  showClass: boolean;
}) {
  const due = formatDueDate(task.dueAt);

  return (
    <Link
      href={`/classes/${task.classId}/tasks/${task.id}`}
      className="block rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50"
    >
      <p className="text-sm font-medium leading-snug">{task.title}</p>
      {showClass && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <ClassColorBadge color={task.classColor} />
          <span className="truncate text-xs text-muted-foreground">
            {task.className}
          </span>
        </div>
      )}
      <p
        className={`mt-1 text-xs ${due.urgent ? "font-medium text-status-error" : "text-muted-foreground"}`}
      >
        {due.text}
      </p>
    </Link>
  );
}

interface TaskBoardViewProps {
  tasks: TaskWithClass[];
  showClass?: boolean;
}

export function TaskBoardView({ tasks, showClass = true }: TaskBoardViewProps) {
  const grouped = new Map<TaskStatus, TaskWithClass[]>();
  for (const col of columns) {
    grouped.set(col.status, []);
  }
  for (const task of tasks) {
    const status = getTaskStatus(task);
    grouped.get(status)?.push(task);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {columns.map((col) => {
        const items = grouped.get(col.status) ?? [];
        const cfg = statusConfig[col.status];
        return (
          <div key={col.status} className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <span
                className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${cfg.className}`}
              >
                {col.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {items.length}
              </span>
            </div>
            <div className="min-h-24 space-y-2 rounded-lg bg-muted/30 p-2">
              {items.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  No tasks
                </p>
              ) : (
                items.map((task) => (
                  <TaskCard key={task.id} task={task} showClass={showClass} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
