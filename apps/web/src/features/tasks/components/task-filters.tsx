"use client";

import { Check } from "lucide-react";

export interface TaskFilterState {
  unfinished: boolean;
  notSubmitted: boolean;
  overdue: boolean;
  showSubmitted: boolean;
}

interface TaskFiltersProps {
  filters: TaskFilterState;
  onChange: (filters: TaskFilterState) => void;
}

export function TaskFilters({ filters, onChange }: TaskFiltersProps) {
  const togglePills: { key: keyof Omit<TaskFilterState, "showSubmitted">; label: string }[] = [
    { key: "unfinished", label: "Unfinished" },
    { key: "notSubmitted", label: "Not Submitted" },
    { key: "overdue", label: "Overdue" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {togglePills.map((pill) => {
        const isActive = filters[pill.key];
        return (
          <button
            key={pill.key}
            type="button"
            onClick={() =>
              onChange({ ...filters, [pill.key]: !filters[pill.key] })
            }
            className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
              isActive
                ? "border-[var(--class-accent)] bg-[color-mix(in_oklch,var(--class-accent),transparent_90%)]"
                : "border-border text-muted-foreground hover:border-foreground/20"
            }`}
            style={isActive ? { color: "var(--class-accent)" } : undefined}
          >
            {pill.label}
          </button>
        );
      })}

      <button
        type="button"
        onClick={() =>
          onChange({ ...filters, showSubmitted: !filters.showSubmitted })
        }
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
          filters.showSubmitted
            ? "border-[var(--class-accent)] bg-[color-mix(in_oklch,var(--class-accent),transparent_90%)]"
            : "border-border text-muted-foreground hover:border-foreground/20"
        }`}
        style={
          filters.showSubmitted ? { color: "var(--class-accent)" } : undefined
        }
      >
        {filters.showSubmitted && <Check className="h-3 w-3" />}
        Show Submitted
      </button>
    </div>
  );
}
