"use client";

import { useParams } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { useClasses } from "@/features/classes/hooks/use-classes";
import { DashboardContent } from "@/features/dashboard/components/dashboard-content";

export default function ClassPage() {
  const params = useParams();
  const classId = params.classId as string;
  const { classes } = useClasses();
  const cls = classes.find((c) => c.id === classId);

  return (
    <>
      <AppHeader
        segments={[
          { label: "Home", href: "/dashboard" },
          { label: cls?.name ?? "Class" },
        ]}
      />
      <main>
        <DashboardContent
          classId={classId}
          className={cls?.name}
          classColor={cls?.color}
          isOwner={cls?.myRole === "OWNER" || cls?.myRole === "ADMIN"}
        />
      </main>
    </>
  );
}
