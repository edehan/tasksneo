import type { TaskSummary } from "@/lib/api";

export type TaskStatus = "unread" | "read" | "submitted";

/** 4-state display status for prototype UI */
export type DisplayStatus = "submitted" | "overdue" | "in-progress" | "not-started";

export interface TaskWithClass extends TaskSummary {
  classColor: string;
}

export function getTaskStatus(task: TaskSummary): TaskStatus {
  if (task.userState?.viewedAt) return "read";
  return "unread";
}

/** Derive prototype-style 4-state display status */
export function getDisplayStatus(task: TaskSummary): DisplayStatus {
  // Check submission (userState with tags or via separate flag)
  // For now, we consider "submitted" if there's submission data
  // The API doesn't have a direct submitted flag on TaskSummary,
  // so we check if the task has been viewed and has a specific state
  const hasSubmission = task.userState?.tags?.includes("submitted") ?? false;

  if (hasSubmission) return "submitted";
  if (isOverdue(task)) return "overdue";
  if (task.userState?.viewedAt) return "in-progress";
  return "not-started";
}

export const displayStatusConfig: Record<
  DisplayStatus,
  { label: string; colorClass: string }
> = {
  submitted: {
    label: "Submitted",
    colorClass: "text-[#5B8C6A] bg-[#5B8C6A]/10",
  },
  overdue: {
    label: "Overdue",
    colorClass: "text-[#c45c5c] bg-[#c45c5c]/10",
  },
  "in-progress": {
    label: "In Progress",
    colorClass: "text-class-accent bg-class-accent/10",
  },
  "not-started": {
    label: "Not Started",
    colorClass: "text-muted-foreground bg-muted",
  },
};

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

export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${date}, ${time}`;
}

export function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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

/** Fractional days between two dates/strings */
export function daysBetween(
  a: Date | string,
  b: Date | string,
): number {
  const msA = a instanceof Date ? a.getTime() : new Date(a).getTime();
  const msB = b instanceof Date ? b.getTime() : new Date(b).getTime();
  return (msB - msA) / (1000 * 60 * 60 * 24);
}
