"use client";

import { GanttChart, List } from "lucide-react";

export type ViewMode = "gantt" | "list";

const views: { value: ViewMode; label: string; icon: typeof List }[] = [
  { value: "gantt", label: "Gantt", icon: GanttChart },
  { value: "list", label: "List", icon: List },
];

interface ViewSwitcherProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}

export function ViewSwitcher({ value, onChange }: ViewSwitcherProps) {
  return (
    <div className="inline-flex items-center rounded-[9px] bg-muted p-0.5">
      {views.map((view) => {
        const isActive = value === view.value;
        return (
          <button
            key={view.value}
            type="button"
            onClick={() => onChange(view.value)}
            className={`inline-flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-xs transition-all ${
              isActive
                ? "bg-card font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={isActive ? { color: "var(--class-accent)" } : undefined}
          >
            <view.icon className="h-3.5 w-3.5" />
            <span>{view.label}</span>
          </button>
        );
      })}
    </div>
  );
}
