import { SWRProvider } from "@/components/swr-provider";
import { DashboardPage } from "@/features/dashboard/components/dashboard-page";
import { getServerClasses, getServerMyTasks } from "@/lib/server-api";
import { webDataKeys } from "@/lib/web-data-keys";

export default async function HomePage() {
  const [classes, tasks] = await Promise.all([
    getServerClasses(),
    getServerMyTasks(),
  ]);

  return (
    <SWRProvider
      fallbackEntries={[
        { key: webDataKeys.classes(), data: classes },
        { key: webDataKeys.myTasks(), data: tasks },
      ]}
    >
      <DashboardPage initialClasses={classes} initialTasks={tasks} />
    </SWRProvider>
  );
}
