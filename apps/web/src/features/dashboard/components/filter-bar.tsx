"use client";

import { Check, Filter } from "lucide-react";

interface Filters {
  unfinished: boolean;
  notSubmitted: boolean;
  overdue: boolean;
  showSubmitted: boolean;
}

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

interface FilterDef {
  key: keyof Filters;
  label: string;
  showCheck?: boolean;
}

const filterDefs: FilterDef[] = [
  { key: "unfinished", label: "Unfinished" },
  { key: "notSubmitted", label: "Not Submitted" },
  { key: "overdue", label: "Overdue" },
  { key: "showSubmitted", label: "Show Submitted", showCheck: true },
];

export function FilterBar({ filters, onChange }: FilterBarProps) {
  function toggle(key: keyof Filters) {
    onChange({ ...filters, [key]: !filters[key] });
  }

  return (
    <div className="flex items-center gap-2">
      <Filter className="h-4 w-4 text-muted-foreground" />

      {filterDefs.map((def) => {
        const active = filters[def.key];

        return (
          <button
            key={def.key}
            type="button"
            onClick={() => toggle(def.key)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
              active
                ? "border-foreground font-medium text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {def.showCheck && active && <Check className="h-3 w-3" />}
            {def.label}
          </button>
        );
      })}
    </div>
  );
}
