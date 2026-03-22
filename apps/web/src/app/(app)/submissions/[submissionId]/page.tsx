"use client";

import { Suspense } from "react";
import { SubmissionDetailPage } from "@/features/submissions/components/submission-detail-page";

export default function SubmissionDetailRoute() {
  return (
    <Suspense>
      <SubmissionDetailPage />
    </Suspense>
  );
}
