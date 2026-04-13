import { SWRProvider } from "@/components/swr-provider";
import { SubmissionsListPage } from "@/features/submissions/components/submissions-list-page";
import {
  getServerClass,
  getServerTask,
  getServerTaskSubmissions,
} from "@/lib/server-api";
import { webDataKeys } from "@/lib/web-data-keys";

export default async function SubmissionsRoute({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const [initialTask, initialRows] = await Promise.all([
    getServerTask(taskId).catch(() => null),
    getServerTaskSubmissions(taskId).catch(() => []),
  ]);
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
              {
                key: webDataKeys.taskSubmissions(taskId),
                data: initialRows,
              },
            ]
          : []
      }
    >
      <SubmissionsListPage
        initialTask={initialTask}
        initialClass={initialClass}
        initialRows={initialRows}
      />
    </SWRProvider>
  );
}
