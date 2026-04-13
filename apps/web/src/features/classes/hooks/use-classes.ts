"use client";

import { useCallback, useEffect, useState } from "react";

import type { ClassSummary } from "@/lib/api";
import { listClasses } from "@/lib/api";

export function useClasses() {
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listClasses();
      setClasses(data);
    } catch {
      // Let the caller handle errors via the returned empty array
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sharedClasses = classes.filter((c) => !c.isPersonal);
  const personalClass = classes.find((c) => c.isPersonal) ?? null;

  return { classes, sharedClasses, personalClass, loading, reload: load };
}
