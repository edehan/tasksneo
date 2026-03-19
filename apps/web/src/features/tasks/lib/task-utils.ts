import type { TaskSummary } from "@/lib/api";

export type TaskStatus = "unread" | "read" | "submitted";

export interface TaskWithClass extends TaskSummary {
  classColor: string;
}

export function getTaskStatus(task: TaskSummary): TaskStatus {
  if (task.userState?.viewedAt) return "read";
  return "unread";
}

export const statusConfig: Record<
  TaskStatus,
  { label: string; className: string }
> = {
  unread: {
    label: "Unread",
    className: "bg-secondary text-secondary-foreground border-transparent",
  },
  read: {
    label: "Read",
    className: "bg-status-info/10 text-status-info border-transparent",
  },
  submitted: {
    label: "Submitted",
    className: "bg-status-success/10 text-status-success border-transparent",
  },
};

export function formatDueDate(dueAt: string | null): {
  text: string;
  urgent: boolean;
} {
  if (!dueAt) return { text: "No due date", urgent: false };
  const date = new Date(dueAt);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return { text: "Overdue", urgent: true };
  if (days === 0) return { text: "Due today", urgent: true };
  if (days === 1) return { text: "Due tomorrow", urgent: false };
  return {
    text: date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    }),
    urgent: false,
  };
}

export function isOverdue(task: TaskSummary): boolean {
  if (!task.dueAt) return false;
  return new Date(task.dueAt).getTime() < Date.now();
}

export function sortTasksByDue<T extends TaskSummary>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    if (a.dueAt && b.dueAt)
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    if (a.dueAt) return -1;
    if (b.dueAt) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
