"use client";

import type { TaskWithClass } from "@/features/tasks/lib/task-utils";
import type { TaskDetail } from "@/lib/api";

type TaskDetailLike = Pick<
  TaskDetail | TaskWithClass,
  "userState" | "dueAt" | "startAt" | "allowLateSubmission"
>;

export type DetailStatus =
  | "submitted"
  | "overdue"
  | "in-progress"
  | "not-started";

type TranslateFn = (key: string, values?: Record<string, string>) => string;

export function deriveDetailStatus(task: TaskDetailLike): DetailStatus {
  if (task.userState?.submittedAt) return "submitted";
  const now = Date.now();
  const dueAt = task.dueAt ? new Date(task.dueAt).getTime() : null;
  const startAt = task.startAt ? new Date(task.startAt).getTime() : null;
  if (dueAt && dueAt < now) return "overdue";
  if (startAt && startAt <= now && dueAt && dueAt >= now) return "in-progress";
  return "not-started";
}

export function isSubmissionLocked(task: TaskDetailLike): boolean {
  if (!task.dueAt || task.allowLateSubmission) return false;
  return new Date(task.dueAt).getTime() < Date.now();
}

export function getStatusBadge(
  status: DetailStatus,
  accentColor: string,
  t: TranslateFn,
): { label: string; bg: string; text: string } {
  switch (status) {
    case "submitted":
      return { label: t("status.submitted"), bg: "#5B8C6A18", text: "#5B8C6A" };
    case "overdue":
      return { label: t("status.overdue"), bg: "#c45c5c18", text: "#c45c5c" };
    case "in-progress":
      return {
        label: t("status.inProgress"),
        bg: `${accentColor}18`,
        text: accentColor,
      };
    case "not-started":
      return {
        label: t("status.notStarted"),
        bg: "var(--muted)",
        text: "var(--muted-foreground)",
      };
  }
}

export function getFooterText(
  status: DetailStatus,
  dueAt: string | null,
  t: TranslateFn,
  _formatDate: (iso: string | null) => string,
): string {
  if (status === "submitted") return t("footer.submitted");
  if (status === "overdue") return t("footer.overdue");
  if (!dueAt) return t("footer.noDueDate");
  return "";
}
