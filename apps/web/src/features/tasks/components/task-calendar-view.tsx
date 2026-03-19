"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { TaskWithClass } from "@/features/tasks/lib/task-utils";
import { formatDueDate } from "@/features/tasks/lib/task-utils";

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface TaskCalendarViewProps {
  tasks: TaskWithClass[];
}

export function TaskCalendarView({ tasks }: TaskCalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() =>
    startOfMonth(new Date()),
  );

  const { days, tasksByDay } = useMemo(() => {
    const first = startOfMonth(currentMonth);
    const last = endOfMonth(currentMonth);

    // Build grid: pad start to Sunday, pad end to Saturday
    const gridStart = new Date(first);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());

    const gridEnd = new Date(last);
    gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

    const allDays: Date[] = [];
    const cursor = new Date(gridStart);
    while (cursor <= gridEnd) {
      allDays.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    // Index tasks by due date
    const byDay = new Map<string, TaskWithClass[]>();
    for (const task of tasks) {
      if (!task.dueAt) continue;
      const d = new Date(task.dueAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)?.push(task);
    }

    return { days: allDays, tasksByDay: byDay };
  }, [currentMonth, tasks]);

  const today = new Date();

  function prevMonth() {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1),
    );
  }

  function nextMonth() {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1),
    );
  }

  function goToday() {
    setCurrentMonth(startOfMonth(new Date()));
  }

  const monthLabel = currentMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-3">
      {/* Navigation */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">{monthLabel}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={goToday}
          className="ml-auto text-xs"
        >
          Today
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="overflow-hidden rounded-lg border">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="px-2 py-1.5 text-center text-xs font-medium text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
            const dayTasks = tasksByDay.get(key) ?? [];
            const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
            const isToday = isSameDay(day, today);

            return (
              <div
                key={key}
                className={`min-h-24 border-b border-r p-1 ${
                  isCurrentMonth ? "" : "bg-muted/20"
                }`}
              >
                <div
                  className={`mb-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    isToday
                      ? "bg-foreground font-medium text-background"
                      : isCurrentMonth
                        ? "text-foreground"
                        : "text-muted-foreground/50"
                  }`}
                >
                  {day.getDate()}
                </div>
                <div className="space-y-0.5">
                  {dayTasks.slice(0, 3).map((task) => {
                    const due = formatDueDate(task.dueAt);
                    return (
                      <Link
                        key={task.id}
                        href={`/classes/${task.classId}/tasks/${task.id}`}
                        className="block truncate rounded px-1 py-0.5 text-xs leading-tight transition-colors hover:opacity-80"
                        style={{
                          backgroundColor: `${task.classColor}20`,
                          color: task.classColor,
                        }}
                        title={`${task.title}${due.urgent ? " (overdue)" : ""}`}
                      >
                        {task.title}
                      </Link>
                    );
                  })}
                  {dayTasks.length > 3 && (
                    <p className="px-1 text-xs text-muted-foreground">
                      +{dayTasks.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
