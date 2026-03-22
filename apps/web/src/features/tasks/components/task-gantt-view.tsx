"use client";

import { useMemo, useRef } from "react";

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { TaskWithClass } from "@/features/tasks/lib/task-utils";
import { isOverdue } from "@/features/tasks/lib/task-utils";

// ─── Constants ───────────────────────────────────────────────────────────────

const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 34;
const LABEL_WIDTH = 210;

const DAY_WIDTHS: Record<GanttRange, number> = {
  week: 80,
  month: 22,
  "2month": 14,
};

// ─── Types ───────────────────────────────────────────────────────────────────

type GanttRange = "week" | "month" | "2month";

interface TaskGanttViewProps {
  tasks: TaskWithClass[];
  ganttRange: GanttRange;
  onTaskClick?: (task: TaskWithClass) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function diffDays(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

function formatBarDate(iso: string): string {
  const d = new Date(iso);
  const month = d.toLocaleString("en-US", { month: "short" });
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  const m = minutes.toString().padStart(2, "0");
  return `${month} ${day}, ${h}:${m} ${ampm}`;
}

function formatMarkerDate(d: Date): string {
  const month = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const day = d.getDate();
  return `${month} ${day}`;
}

function isSubmitted(task: TaskWithClass): boolean {
  return !!task.userState?.submittedAt;
}

// ─── Timeline Range ──────────────────────────────────────────────────────────

function computeTimelineRange(
  tasks: TaskWithClass[],
  range: GanttRange,
): { start: Date; end: Date } {
  const today = startOfDay(new Date());

  if (range === "week") {
    const start = new Date(today);
    start.setDate(start.getDate() - 1);
    const end = new Date(today);
    end.setDate(end.getDate() + 7);
    return { start, end };
  }

  // For month and 2month, fit all tasks with padding
  const minSpan = range === "month" ? 30 : 60;
  const padding = range === "month" ? 2 : 5;

  let earliest = today;
  let latest = new Date(today);
  latest.setDate(latest.getDate() + minSpan);

  for (const task of tasks) {
    const taskStart = task.startAt
      ? startOfDay(new Date(task.startAt))
      : startOfDay(new Date(task.createdAt));
    const taskEnd = task.dueAt
      ? startOfDay(new Date(task.dueAt))
      : taskStart;

    if (taskStart < earliest) earliest = new Date(taskStart);
    if (taskEnd > latest) latest = new Date(taskEnd);
  }

  const start = new Date(earliest);
  start.setDate(start.getDate() - padding);
  const end = new Date(latest);
  end.setDate(end.getDate() + padding);

  // Enforce minimum span
  const span = diffDays(start, end);
  if (span < minSpan) {
    end.setDate(start.getDate() + minSpan);
  }

  return { start, end };
}

// ─── Date Markers ────────────────────────────────────────────────────────────

function computeMarkers(
  start: Date,
  end: Date,
  range: GanttRange,
): { label: string; dayOffset: number }[] {
  const interval = range === "week" ? 1 : range === "month" ? 7 : 14;
  const markers: { label: string; dayOffset: number }[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    const offset = diffDays(start, cursor);
    markers.push({ label: formatMarkerDate(cursor), dayOffset: offset });
    cursor.setDate(cursor.getDate() + interval);
  }

  return markers;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TaskGanttView({
  tasks,
  ganttRange,
  onTaskClick,
}: TaskGanttViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dayWidth = DAY_WIDTHS[ganttRange];

  const { timelineStart, totalDays, markers } = useMemo(() => {
    const { start, end } = computeTimelineRange(tasks, ganttRange);
    const total = Math.ceil(diffDays(start, end));
    const m = computeMarkers(start, end, ganttRange);
    return { timelineStart: start, totalDays: total, markers: m };
  }, [tasks, ganttRange]);

  const todayOffset = diffDays(timelineStart, startOfDay(new Date()));
  const totalWidth = totalDays * dayWidth;

  if (tasks.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No tasks to display.
      </p>
    );
  }

  return (
    <div className="flex overflow-hidden rounded-lg border">
      {/* Left: pinned task column */}
      <div
        className="shrink-0 border-r bg-card"
        style={{ width: LABEL_WIDTH }}
      >
        {/* Header spacer */}
        <div
          className="border-b"
          style={{ height: HEADER_HEIGHT }}
        />
        {/* Task rows */}
        {tasks.map((task) => {
          const submitted = isSubmitted(task);
          return (
            <div
              key={task.id}
              className="group flex cursor-pointer items-center gap-2 border-b px-3 transition-colors duration-150 hover:bg-surface-subtle"
              style={{ height: ROW_HEIGHT }}
              onClick={() => onTaskClick?.(task)}
            >
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-sm"
                style={{ backgroundColor: task.classColor }}
              />
              <span
                className={`truncate font-sans leading-none ${
                  submitted
                    ? "text-text-muted-soft line-through"
                    : "text-foreground"
                }`}
                style={{ fontSize: 13 }}
              >
                {task.title}
              </span>
            </div>
          );
        })}
      </div>

      {/* Right: scrollable timeline */}
      <ScrollArea className="min-w-0 flex-1" ref={scrollRef}>
        <div style={{ width: totalWidth, minWidth: "100%" }}>
          {/* Header with date markers */}
          <div
            className="relative border-b"
            style={{ height: HEADER_HEIGHT }}
          >
            {markers.map((m) => (
              <div
                key={m.dayOffset}
                className="absolute bottom-0 pb-1.5 font-sans text-text-muted-soft"
                style={{
                  left: m.dayOffset * dayWidth,
                  fontSize: 10,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {m.label}
              </div>
            ))}

            {/* Today label in header */}
            {todayOffset >= 0 && todayOffset <= totalDays && (
              <div
                className="absolute bottom-1 z-20 rounded px-1 py-0.5 font-sans font-semibold text-white"
                style={{
                  left: todayOffset * dayWidth,
                  transform: "translateX(-50%)",
                  backgroundColor: "#d6394c",
                  fontSize: 8,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  lineHeight: 1,
                }}
              >
                TODAY
              </div>
            )}
          </div>

          {/* Row area */}
          <div className="relative">
            {/* Vertical grid lines for markers */}
            {markers.map((m) => (
              <div
                key={`grid-${m.dayOffset}`}
                className="absolute top-0 bottom-0 border-l border-border/40"
                style={{ left: m.dayOffset * dayWidth }}
              />
            ))}

            {/* Today line */}
            {todayOffset >= 0 && todayOffset <= totalDays && (
              <div
                className="absolute top-0 bottom-0 z-10"
                style={{
                  left: todayOffset * dayWidth,
                  width: 2,
                  backgroundColor: "#d6394c",
                }}
              />
            )}

            {/* Task rows with bars */}
            {tasks.map((task) => {
              const submitted = isSubmitted(task);
              const overdue = !submitted && isOverdue(task);

              const barStartDate = task.startAt
                ? new Date(task.startAt)
                : new Date(task.createdAt);
              const barEndDate = task.dueAt
                ? new Date(task.dueAt)
                : new Date(barStartDate.getTime() + 7 * 24 * 60 * 60 * 1000);

              const startOffset = diffDays(timelineStart, barStartDate);
              const endOffset = diffDays(timelineStart, barEndDate);

              const left = Math.max(0, startOffset) * dayWidth;
              const right = Math.min(totalDays, endOffset) * dayWidth;
              const width = Math.max(right - left, dayWidth * 0.5);

              // Bar color: submitted = muted gray, otherwise classColor with low opacity
              const barBg = submitted ? "#c0b8ad28" : `${task.classColor}28`;
              const barBorder = overdue
                ? `1px dashed ${task.classColor}`
                : "none";

              // Bar label color
              const labelColor = submitted ? "#c0b8ad" : task.classColor;

              // Build the bar label text
              const barLabel =
                task.startAt && task.dueAt
                  ? `${formatBarDate(task.startAt)} — ${formatBarDate(task.dueAt)}`
                  : task.dueAt
                    ? `Due ${formatBarDate(task.dueAt)}`
                    : "";

              return (
                <div
                  key={task.id}
                  className="group relative cursor-pointer border-b transition-colors duration-150 hover:bg-surface-subtle"
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => onTaskClick?.(task)}
                >
                  <div
                    className="absolute top-1/2 rounded-sm transition-transform duration-150 group-hover:scale-y-[1.15]"
                    style={{
                      left,
                      width,
                      height: ROW_HEIGHT - 16,
                      transform: "translateY(-50%)",
                      backgroundColor: barBg,
                      border: barBorder,
                      borderRadius: 4,
                      overflow: "hidden",
                    }}
                  >
                    {barLabel && (
                      <span
                        className="pointer-events-none absolute inset-0 flex items-center truncate px-1.5 font-sans"
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: labelColor,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {barLabel}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
