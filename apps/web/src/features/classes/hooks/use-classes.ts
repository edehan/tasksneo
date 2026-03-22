"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import type { ClassSummary } from "@/lib/api";
import { listClasses } from "@/lib/api";

export function useClasses() {
  const { token } = useAuth();
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await listClasses(token);
      setClasses(data);
    } catch {
      // Let the caller handle errors via the returned empty array
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const sharedClasses = classes.filter((c) => !c.isPersonal);
  const personalClass = classes.find((c) => c.isPersonal) ?? null;

  return { classes, sharedClasses, personalClass, loading, reload: load };
}
