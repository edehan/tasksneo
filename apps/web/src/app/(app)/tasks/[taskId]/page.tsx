import { SWRProvider } from "@/components/swr-provider";
import { TaskDetailPage } from "@/features/tasks/components/task-detail-page";
import { getServerClass, getServerTask } from "@/lib/server-api";
import { webDataKeys } from "@/lib/web-data-keys";

export default async function TaskDetailRoute({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const initialTask = await getServerTask(taskId).catch(() => null);
  const initialClass = initialTask
    ? await getServerClass(initialTask.classId).catch(() => null)
    : null;

  return (
    <SWRProvider
      fallbackEntries={
        initialTask && initialClass
          ? [
              { key: webDataKeys.task(taskId), data: initialTask },
              {
                key: webDataKeys.class(initialTask.classId),
                data: initialClass,
              },
            ]
          : []
      }
    >
      <TaskDetailPage initialTask={initialTask} initialClass={initialClass} />
    </SWRProvider>
  );
}
