"use client";

import type { TaskWithClass } from "@/features/tasks/lib/task-utils";
import { getDisplayStatus } from "@/features/tasks/lib/task-utils";

interface TaskStatsProps {
  tasks: TaskWithClass[];
}

export function TaskStats({ tasks }: TaskStatsProps) {
  const total = tasks.length;
  let inProgress = 0;
  let overdue = 0;
  let notStarted = 0;

  for (const task of tasks) {
    const status = getDisplayStatus(task);
    if (status === "in-progress") inProgress++;
    else if (status === "overdue") overdue++;
    else if (status === "not-started") notStarted++;
  }

  const stats = [
    { label: "Total", value: total, color: "var(--class-accent)" },
    { label: "In Progress", value: inProgress, color: "var(--class-accent)" },
    {
      label: "Overdue",
      value: overdue,
      color: "#c45c5c",
      highlight: overdue > 0,
    },
    { label: "Not Started", value: notStarted, color: undefined },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`rounded-xl border px-4 py-3 ${
            stat.highlight
              ? "border-[#c45c5c]/20 bg-[#c45c5c]/[0.04]"
              : "bg-card"
          }`}
        >
          <div
            className="font-serif text-xl font-bold"
            style={{ color: stat.color }}
          >
            {stat.value}
          </div>
          <div className="text-xs text-muted-foreground">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
