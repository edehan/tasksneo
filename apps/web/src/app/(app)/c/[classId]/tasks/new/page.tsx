"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { classPath } from "@/lib/routes";

export default function ShortNewTaskRoute() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    router.replace(classPath(params?.classId as string));
  }, [params?.classId, router]);

  return null;
}
