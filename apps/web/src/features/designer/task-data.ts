import type { TaskViewItem } from "@/features/designer/task-views";
import type { ClassSummary } from "@/lib/api";
import { getMySubmission, listClassTasks } from "@/lib/api";

export async function loadTasksForClasses(
  token: string,
  classes: ClassSummary[],
) {
  const taskBuckets = await Promise.all(
    classes.map(async (cls) => {
      const tasks = await listClassTasks(token, cls.id);
      return tasks.map((task) => ({
        ...task,
        classColor: cls.color,
        classNameResolved: cls.name,
        hasSubmission: false,
      }));
    }),
  );

  const merged = taskBuckets.flat();

  const submissionChecks = await Promise.all(
    merged.map(async (task) => {
      try {
        const submission = await getMySubmission(token, task.id);
        return [task.id, Boolean(submission)] as const;
      } catch {
        return [task.id, false] as const;
      }
    }),
  );

  const submissionMap = new Map<string, boolean>(submissionChecks);

  const result: TaskViewItem[] = merged.map((task) => ({
    ...task,
    hasSubmission: submissionMap.get(task.id) ?? false,
  }));

  result.sort((a, b) => {
    const aTime = new Date(a.dueAt || a.createdAt).getTime();
    const bTime = new Date(b.dueAt || b.createdAt).getTime();
    return aTime - bTime;
  });

  return result;
}
