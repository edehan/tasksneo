"use client";

import { AppHeader } from "@/components/app-header";
import { DashboardContent } from "@/features/dashboard/components/dashboard-content";

export default function DashboardPage() {
  return (
    <>
      <AppHeader segments={[{ label: "Home" }]} />
      <main>
        <DashboardContent />
      </main>
    </>
  );
}
