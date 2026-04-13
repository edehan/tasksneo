"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { getClass, listClasses } from "@/lib/api";

const DEFAULT_ACCENT = "#7B6CB0";

/**
 * Reads classId from route params, fetches the class color, and sets --class-accent CSS variable.
 * Returns the current accent color hex string.
 */
export function useClassAccent(): string {
  const params = useParams();
  const [accent, setAccent] = useState(DEFAULT_ACCENT);

  const classId = typeof params?.classId === "string" ? params.classId : null;

  const updateAccent = useCallback(async (id: string) => {
    try {
      const cls = await getClass(id);
      const color = cls.color || DEFAULT_ACCENT;
      setAccent(color);
      document.documentElement.style.setProperty("--class-accent", color);
    } catch {
      // fallback to default
    }
  }, []);

  useEffect(() => {
    if (classId) {
      void updateAccent(classId);
    } else {
      // Use personal space color as fallback on non-class pages (e.g. /dashboard)
      void listClasses()
        .then((classes) => {
          const personal = classes.find((c) => c.isPersonal);
          const color = personal?.color || DEFAULT_ACCENT;
          setAccent(color);
          document.documentElement.style.setProperty("--class-accent", color);
        })
        .catch(() => {
          setAccent(DEFAULT_ACCENT);
          document.documentElement.style.setProperty(
            "--class-accent",
            DEFAULT_ACCENT,
          );
        });
    }
  }, [classId, updateAccent]);

  return accent;
}
