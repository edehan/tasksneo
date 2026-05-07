import type { TaskSummary } from "@/lib/api";

export type TaskStatus = "unread" | "read" | "submitted";

export interface TaskWithClass extends TaskSummary {
  classColor: string;
}

export const TASK_ARCHIVED_TAG = "__archived__";

export function isTaskArchived(task: Pick<TaskSummary, "userState">): boolean {
  return task.userState?.tags.includes(TASK_ARCHIVED_TAG) ?? false;
}

export function getTaskTagsWithArchive(
  tags: string[] | undefined,
  archived: boolean,
): string[] {
  const current = tags?.filter((tag) => tag !== TASK_ARCHIVED_TAG) ?? [];
  return archived ? [...current, TASK_ARCHIVED_TAG] : current;
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

// ─── Blocked-by grouping ────────────────────────────────────────────────────

export interface BlockedByConnector {
  fromId: string;
  toId: string;
}

export interface BlockedBySortResult<T extends TaskSummary> {
  tasks: T[];
  connectors: BlockedByConnector[];
}

/**
 * Groups tasks by their blockedBy relationships and sorts them so that
 * connected tasks appear together. Only unsubmitted tasks participate in
 * grouping; submitted tasks are appended at the end sorted by due date.
 *
 * Returns the sorted task list and a list of connectors to draw.
 */
export function sortTasksWithBlockedBy<T extends TaskSummary>(
  tasks: T[],
): BlockedBySortResult<T> {
  const taskMap = new Map<string, T>();
  for (const task of tasks) taskMap.set(task.id, task);

  // Split into submitted (excluded from grouping) and active
  const submitted: T[] = [];
  const active: T[] = [];
  for (const task of tasks) {
    if (task.userState?.submittedAt) {
      submitted.push(task);
    } else {
      active.push(task);
    }
  }

  // Build adjacency: undirected edges between active tasks with blockedBy links
  const adj = new Map<string, Set<string>>();
  for (const task of active) {
    if (!adj.has(task.id)) adj.set(task.id, new Set());
    for (const depId of task.blockedBy) {
      const dep = taskMap.get(depId);
      if (!dep || dep.userState?.submittedAt) continue;
      if (!adj.has(depId)) adj.set(depId, new Set());
      const taskAdj = adj.get(task.id);
      const depAdj = adj.get(depId);
      if (taskAdj) taskAdj.add(depId);
      if (depAdj) depAdj.add(task.id);
    }
  }

  // Find connected components via BFS
  const visited = new Set<string>();
  const groups: T[][] = [];

  for (const task of active) {
    if (visited.has(task.id)) continue;
    const group: T[] = [];
    const queue = [task.id];
    visited.add(task.id);

    while (queue.length > 0) {
      const id = queue.shift();
      if (id === undefined) break;
      const t = taskMap.get(id);
      if (t && !t.userState?.submittedAt) group.push(t);

      const neighbors = adj.get(id);
      if (neighbors) {
        for (const nid of neighbors) {
          if (!visited.has(nid)) {
            visited.add(nid);
            queue.push(nid);
          }
        }
      }
    }

    groups.push(group);
  }

  // Sort each group internally by due date (earliest first)
  const byDue = (a: T, b: T) => {
    if (a.dueAt && b.dueAt)
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    if (a.dueAt) return -1;
    if (b.dueAt) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  };
  for (const g of groups) g.sort(byDue);

  // Sort groups by their earliest due date
  const groupKey = (g: T[]): number => {
    for (const t of g) {
      if (t.dueAt) return new Date(t.dueAt).getTime();
    }
    return Number.MAX_SAFE_INTEGER;
  };
  groups.sort((a, b) => groupKey(a) - groupKey(b));

  // Flatten groups + append submitted
  const sorted = groups.flat();
  sorted.push(...sortTasksByDue(submitted));

  // Build connectors: directed edges from prerequisite → dependent
  const sortedIndex = new Map<string, number>();
  for (let i = 0; i < sorted.length; i++) sortedIndex.set(sorted[i].id, i);

  const connectors: BlockedByConnector[] = [];
  for (const task of active) {
    for (const depId of task.blockedBy) {
      if (sortedIndex.has(depId) && sortedIndex.has(task.id)) {
        connectors.push({ fromId: depId, toId: task.id });
      }
    }
  }

  return { tasks: sorted, connectors };
}
