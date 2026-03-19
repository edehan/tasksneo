"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ClassColorBadge } from "@/components/class-color-badge";
import { Badge } from "@/components/ui/badge";
import type { TaskWithClass } from "@/features/tasks/lib/task-utils";
import {
  formatDueDate,
  getTaskStatus,
  isOverdue,
  statusConfig,
} from "@/features/tasks/lib/task-utils";

function TaskRow({
  task,
  showClass,
}: {
  task: TaskWithClass;
  showClass: boolean;
}) {
  const status = getTaskStatus(task);
  const cfg = statusConfig[status];
  const due = formatDueDate(task.dueAt);

  return (
    <Link
      href={`/classes/${task.classId}/tasks/${task.id}`}
      className="flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors hover:bg-accent/50"
    >
      {showClass && <ClassColorBadge color={task.classColor} />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{task.title}</p>
        {showClass && (
          <p className="truncate text-xs text-muted-foreground">
            {task.className}
          </p>
        )}
      </div>
      <span
        className={`shrink-0 text-xs ${due.urgent ? "font-medium text-status-error" : "text-muted-foreground"}`}
      >
        {due.text}
      </span>
      <Badge variant="outline" className={`shrink-0 text-xs ${cfg.className}`}>
        {cfg.label}
      </Badge>
    </Link>
  );
}

interface TaskListViewProps {
  tasks: TaskWithClass[];
  showClass?: boolean;
}

export function TaskListView({ tasks, showClass = true }: TaskListViewProps) {
  const [showOverdue, setShowOverdue] = useState(false);

  const activeTasks = tasks.filter((t) => !isOverdue(t));
  const overdueTasks = tasks.filter((t) => isOverdue(t));

  return (
    <div className="space-y-2">
      {activeTasks.map((task) => (
        <TaskRow key={task.id} task={task} showClass={showClass} />
      ))}

      {overdueTasks.length > 0 && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowOverdue(!showOverdue)}
            className="flex w-full items-center gap-2 rounded-lg px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/50"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showOverdue ? "rotate-0" : "-rotate-90"}`}
            />
            <span>Overdue ({overdueTasks.length})</span>
          </button>
          {showOverdue && (
            <div className="mt-1 space-y-2 opacity-75">
              {overdueTasks.map((task) => (
                <TaskRow key={task.id} task={task} showClass={showClass} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
