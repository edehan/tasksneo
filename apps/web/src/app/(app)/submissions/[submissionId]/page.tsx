import { SWRProvider } from "@/components/swr-provider";
import { SubmissionDetailPage } from "@/features/submissions/components/submission-detail-page";
import type { SubmissionListRow } from "@/lib/api";
import {
  getServerClass,
  getServerSubmissionById,
  getServerTask,
  getServerTaskSubmissions,
} from "@/lib/server-api";
import { webDataKeys } from "@/lib/web-data-keys";

export default async function SubmissionDetailRoute({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;
  const initialSubmission = await getServerSubmissionById(submissionId).catch(
    () => null,
  );
  const initialTask = initialSubmission
    ? await getServerTask(initialSubmission.taskId).catch(() => null)
    : null;
  const [initialClass, initialRows] = initialTask
    ? await Promise.all([
        getServerClass(initialTask.classId).catch(() => null),
        getServerTaskSubmissions(initialTask.id).catch(() => []),
      ])
    : [null, [] as SubmissionListRow[]];

  return (
    <SWRProvider
      fallbackEntries={
        initialTask && initialClass
          ? [
              { key: webDataKeys.task(initialTask.id), data: initialTask },
              {
                key: webDataKeys.class(initialTask.classId),
                data: initialClass,
              },
              {
                key: webDataKeys.taskSubmissions(initialTask.id),
                data: initialRows,
              },
            ]
          : []
      }
    >
      <SubmissionDetailPage
        initialSubmission={initialSubmission}
        initialTask={initialTask}
        initialClass={initialClass}
        initialRows={initialRows}
      />
    </SWRProvider>
  );
}
