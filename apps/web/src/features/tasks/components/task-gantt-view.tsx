"use client";

import { useMemo } from "react";

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { TaskWithClass } from "@/features/tasks/lib/task-utils";

const DAY_WIDTH = 28;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 48;
const LABEL_WIDTH = 180;

function getDaysBetween(start: Date, end: Date): number {
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

interface TaskGanttViewProps {
  tasks: TaskWithClass[];
}

export function TaskGanttView({ tasks }: TaskGanttViewProps) {
  const { timelineStart, timelineDays, weeks, groups } = useMemo(() => {
    const now = new Date();
    // Range: current month ±2 weeks
    const rangeStart = startOfDay(
      new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14),
    );
    const rangeEnd = startOfDay(
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 42),
    );
    const totalDays = getDaysBetween(rangeStart, rangeEnd);

    // Group tasks by class
    const classGroups = new Map<
      string,
      { name: string; color: string; tasks: TaskWithClass[] }
    >();
    for (const task of tasks) {
      const key = task.classId;
      if (!classGroups.has(key)) {
        classGroups.set(key, {
          name: task.className,
          color: task.classColor,
          tasks: [],
        });
      }
      classGroups.get(key)?.tasks.push(task);
    }

    // Generate week markers
    const weekMarkers: { label: string; dayOffset: number }[] = [];
    const cursor = new Date(rangeStart);
    // Move to next Monday
    cursor.setDate(cursor.getDate() + ((8 - cursor.getDay()) % 7));
    while (cursor < rangeEnd) {
      const offset = getDaysBetween(rangeStart, cursor);
      weekMarkers.push({
        label: cursor.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        dayOffset: offset,
      });
      cursor.setDate(cursor.getDate() + 7);
    }

    return {
      timelineStart: rangeStart,
      timelineDays: totalDays,
      weeks: weekMarkers,
      groups: Array.from(classGroups.values()),
    };
  }, [tasks]);

  const todayOffset = getDaysBetween(timelineStart, startOfDay(new Date()));
  const totalWidth = timelineDays * DAY_WIDTH;

  // Flatten rows for Y positioning
  const rows: {
    task: TaskWithClass;
    color: string;
  }[] = [];
  for (const group of groups) {
    for (const task of group.tasks) {
      rows.push({ task, color: group.color });
    }
  }

  if (tasks.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No tasks to display.
      </p>
    );
  }

  return (
    <ScrollArea className="w-full rounded-lg border">
      <div className="flex">
        {/* Left labels */}
        <div
          className="shrink-0 border-r bg-muted/30"
          style={{ width: LABEL_WIDTH }}
        >
          <div
            className="flex items-end border-b px-3 text-xs font-medium text-muted-foreground"
            style={{ height: HEADER_HEIGHT }}
          >
            Task
          </div>
          {rows.map(({ task, color }) => (
            <div
              key={task.id}
              className="flex items-center gap-2 border-b px-3"
              style={{ height: ROW_HEIGHT }}
            >
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="truncate text-xs">{task.title}</span>
            </div>
          ))}
        </div>

        {/* Timeline area */}
        <div className="relative min-w-0 flex-1 overflow-x-auto">
          <div style={{ width: totalWidth, minWidth: "100%" }}>
            {/* Header with week markers */}
            <div
              className="relative border-b"
              style={{ height: HEADER_HEIGHT }}
            >
              {weeks.map((w) => (
                <div
                  key={w.dayOffset}
                  className="absolute bottom-0 border-l px-1 pb-1 text-xs text-muted-foreground"
                  style={{ left: w.dayOffset * DAY_WIDTH }}
                >
                  {w.label}
                </div>
              ))}
            </div>

            {/* Rows */}
            <div className="relative">
              {/* Grid lines for weeks */}
              {weeks.map((w) => (
                <div
                  key={`line-${w.dayOffset}`}
                  className="absolute top-0 bottom-0 border-l border-dashed border-border/50"
                  style={{ left: w.dayOffset * DAY_WIDTH }}
                />
              ))}

              {/* Today line */}
              {todayOffset >= 0 && todayOffset <= timelineDays && (
                <div
                  className="absolute top-0 bottom-0 z-10 w-0.5 bg-status-error"
                  style={{ left: todayOffset * DAY_WIDTH }}
                />
              )}

              {/* Task bars */}
              {rows.map(({ task, color }) => {
                const barStart = task.startAt
                  ? getDaysBetween(timelineStart, new Date(task.startAt))
                  : getDaysBetween(timelineStart, new Date(task.createdAt));
                const barEnd = task.dueAt
                  ? getDaysBetween(timelineStart, new Date(task.dueAt))
                  : barStart + 7; // Default 7-day width

                const left = Math.max(0, barStart) * DAY_WIDTH;
                const right = Math.min(timelineDays, barEnd) * DAY_WIDTH;
                const width = Math.max(right - left, DAY_WIDTH);

                return (
                  <div
                    key={task.id}
                    className="relative border-b"
                    style={{ height: ROW_HEIGHT }}
                  >
                    <div
                      className="absolute top-1.5 rounded"
                      style={{
                        left,
                        width,
                        height: ROW_HEIGHT - 12,
                        backgroundColor: color,
                        opacity: 0.85,
                      }}
                    />
                  </div>
                );
              })}

              {/* Dependency arrows */}
              <svg
                role="img"
                aria-label="Task dependency arrows"
                className="pointer-events-none absolute inset-0"
                style={{
                  width: totalWidth,
                  height: rows.length * ROW_HEIGHT,
                }}
              >
                <title>Task dependency arrows</title>
                {rows.map(({ task }, targetIdx) =>
                  task.blockedBy.map((depId) => {
                    const sourceIdx = rows.findIndex(
                      (r) => r.task.id === depId,
                    );
                    if (sourceIdx === -1) return null;

                    const sourceTask = rows[sourceIdx].task;
                    const sourceEnd = sourceTask.dueAt
                      ? getDaysBetween(
                          timelineStart,
                          new Date(sourceTask.dueAt),
                        )
                      : getDaysBetween(
                          timelineStart,
                          new Date(sourceTask.createdAt),
                        ) + 7;

                    const targetStart = task.startAt
                      ? getDaysBetween(timelineStart, new Date(task.startAt))
                      : getDaysBetween(timelineStart, new Date(task.createdAt));

                    const x1 = Math.min(timelineDays, sourceEnd) * DAY_WIDTH;
                    const y1 = sourceIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                    const x2 = Math.max(0, targetStart) * DAY_WIDTH;
                    const y2 = targetIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

                    return (
                      <g key={`${depId}-${task.id}`}>
                        <line
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke="currentColor"
                          strokeWidth={1}
                          className="text-muted-foreground/40"
                          markerEnd="url(#arrowhead)"
                        />
                      </g>
                    );
                  }),
                )}
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="6"
                    markerHeight="4"
                    refX="6"
                    refY="2"
                    orient="auto"
                  >
                    <polygon
                      points="0 0, 6 2, 0 4"
                      className="fill-muted-foreground/40"
                    />
                  </marker>
                </defs>
              </svg>
            </div>
          </div>
        </div>
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
