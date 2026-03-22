"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function NewTaskRoute() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/classes/${params?.classId}`);
  }, [params?.classId, router]);

  return null;
}
