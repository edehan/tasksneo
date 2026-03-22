"use client";

import { BarChart3, List } from "lucide-react";

export type ViewMode = "gantt" | "list";

interface ViewSwitcherProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewSwitcher({ mode, onChange }: ViewSwitcherProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange("gantt")}
        className={`flex items-center gap-2 rounded-lg border px-[14px] py-[7px] text-xs transition-colors ${
          mode === "gantt"
            ? "border-foreground bg-foreground/5 font-medium text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <BarChart3 className="h-4 w-4" />
        Gantt
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        className={`flex items-center gap-2 rounded-lg border px-[14px] py-[7px] text-xs transition-colors ${
          mode === "list"
            ? "border-foreground bg-foreground/5 font-medium text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <List className="h-4 w-4" />
        List
      </button>
    </div>
  );
}
