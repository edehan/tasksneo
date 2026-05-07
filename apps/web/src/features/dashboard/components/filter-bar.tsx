"use client";

import { Check, Filter } from "lucide-react";
import { useTranslations } from "next-intl";
import type { TaskFilters } from "@/hooks/use-task-filter-prefs";

interface FilterBarProps {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
}

interface FilterDef {
  key: keyof TaskFilters;
  labelKey: string;
  showCheck?: boolean;
}

const filterDefs: FilterDef[] = [
  { key: "notSubmitted", labelKey: "notSubmitted" },
  { key: "overdue", labelKey: "overdue" },
  { key: "showSubmitted", labelKey: "showSubmitted", showCheck: true },
  { key: "showLongOverdue", labelKey: "showLongOverdue", showCheck: true },
  { key: "showArchived", labelKey: "showArchived", showCheck: true },
];

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const t = useTranslations("dashboardFilterBar");

  function toggle(key: keyof TaskFilters) {
    onChange({ ...filters, [key]: !filters[key] });
  }

  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-2 xl:justify-end">
      <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />

      {filterDefs.map((def) => {
        const active = filters[def.key];

        return (
          <button
            key={def.key}
            type="button"
            onClick={() => toggle(def.key)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
              active
                ? "border-foreground font-medium text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {def.showCheck && active && <Check className="h-3 w-3" />}
            {t(def.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
