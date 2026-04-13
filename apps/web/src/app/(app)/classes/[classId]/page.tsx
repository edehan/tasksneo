import { SWRProvider } from "@/components/swr-provider";
import { ClassPage } from "@/features/classes/components/class-page";
import { getServerClass, getServerClassTasks } from "@/lib/server-api";
import { webDataKeys } from "@/lib/web-data-keys";

export default async function ClassRoute({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const [initialClass, initialTasks] = await Promise.all([
    getServerClass(classId).catch(() => null),
    getServerClassTasks(classId).catch(() => []),
  ]);

  return (
    <SWRProvider
      fallbackEntries={
        initialClass
          ? [
              { key: webDataKeys.class(classId), data: initialClass },
              { key: webDataKeys.classTasks(classId), data: initialTasks },
            ]
          : []
      }
    >
      <ClassPage initialClass={initialClass} initialTasks={initialTasks} />
    </SWRProvider>
  );
}
