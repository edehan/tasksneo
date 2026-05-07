"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "taskflow:task-filter-prefs";

export interface TaskFilters {
  notSubmitted: boolean;
  overdue: boolean;
  showSubmitted: boolean;
  showLongOverdue: boolean;
  showArchived: boolean;
}

const DEFAULT_FILTERS: TaskFilters = {
  notSubmitted: false,
  overdue: false,
  showSubmitted: false,
  showLongOverdue: false,
  showArchived: false,
};

function readPrefs(): Pick<
  TaskFilters,
  "showSubmitted" | "showLongOverdue" | "showArchived"
> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return {
        showSubmitted: DEFAULT_FILTERS.showSubmitted,
        showLongOverdue: DEFAULT_FILTERS.showLongOverdue,
        showArchived: DEFAULT_FILTERS.showArchived,
      };
    }

    const parsed = JSON.parse(stored) as Partial<TaskFilters>;
    return {
      showSubmitted:
        typeof parsed.showSubmitted === "boolean"
          ? parsed.showSubmitted
          : DEFAULT_FILTERS.showSubmitted,
      showLongOverdue:
        typeof parsed.showLongOverdue === "boolean"
          ? parsed.showLongOverdue
          : DEFAULT_FILTERS.showLongOverdue,
      showArchived:
        typeof parsed.showArchived === "boolean"
          ? parsed.showArchived
          : DEFAULT_FILTERS.showArchived,
    };
  } catch {
    return {
      showSubmitted: DEFAULT_FILTERS.showSubmitted,
      showLongOverdue: DEFAULT_FILTERS.showLongOverdue,
      showArchived: DEFAULT_FILTERS.showArchived,
    };
  }
}

export function useTaskFilterPrefs(): [
  TaskFilters,
  (filters: TaskFilters) => void,
  boolean,
] {
  const [filters, setFiltersState] = useState<TaskFilters>(DEFAULT_FILTERS);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const prefs = readPrefs();
    setFiltersState((current) => ({ ...current, ...prefs }));
    setIsHydrated(true);
  }, []);

  const setFilters = useCallback((next: TaskFilters) => {
    setFiltersState(next);
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          showSubmitted: next.showSubmitted,
          showLongOverdue: next.showLongOverdue,
          showArchived: next.showArchived,
        }),
      );
    } catch {
      // Ignore localStorage errors.
    }
  }, []);

  return [filters, setFilters, isHydrated];
}
