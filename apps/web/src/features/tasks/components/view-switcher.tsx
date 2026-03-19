"use client";

import { Calendar, GanttChart, Kanban, List } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type ViewMode = "list" | "board" | "gantt" | "calendar";

const views: { value: ViewMode; label: string; icon: typeof List }[] = [
  { value: "list", label: "List", icon: List },
  { value: "board", label: "Board", icon: Kanban },
  { value: "gantt", label: "Gantt", icon: GanttChart },
  { value: "calendar", label: "Calendar", icon: Calendar },
];

interface ViewSwitcherProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}

export function ViewSwitcher({ value, onChange }: ViewSwitcherProps) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as ViewMode)}>
      <TabsList>
        {views.map((view) => (
          <TabsTrigger key={view.value} value={view.value} className="gap-1.5">
            <view.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{view.label}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
