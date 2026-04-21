"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "taskflow:gantt-zoom";

export function useGanttZoom(
  defaultValue: number,
): [number, (value: number) => void, boolean] {
  const [dayWidth, setDayWidth] = useState(defaultValue);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage after mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = Number.parseFloat(stored);
        if (!Number.isNaN(parsed) && parsed > 0) {
          setDayWidth(parsed);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, String(dayWidth));
    } catch {
      // Ignore localStorage errors
    }
  }, [dayWidth, isHydrated]);

  return [dayWidth, setDayWidth, isHydrated];
}
