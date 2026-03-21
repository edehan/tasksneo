"use client";

import { useMemo, useRef, useState } from "react";

import type { TaskWithClass } from "@/features/tasks/lib/task-utils";
import {
  daysBetween,
  formatDateShort,
  getDisplayStatus,
} from "@/features/tasks/lib/task-utils";

export type GanttRange = "week" | "1month" | "2month";

interface TaskGanttViewProps {
  tasks: TaskWithClass[];
  range: GanttRange;
  onTaskClick?: (task: TaskWithClass) => void;
}

const ROW_H = 44;
const HEADER_H = 34;
const TASK_COL_W = 210;

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function formatDateBar(dateStr: string): string {
  const d = new Date(dateStr);
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${date} ${time}`;
}

export function TaskGanttView({ tasks, range, onTaskClick }: TaskGanttViewProps) {
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const { sortedTasks, minDate, maxDate, totalDays, todayOffset, markers, dayWidth } =
    useMemo(() => {
      const now = startOfDay(new Date());
      const sorted = [...tasks].sort(
        (a, b) =>
          new Date(a.dueAt ?? a.createdAt).getTime() -
          new Date(b.dueAt ?? b.createdAt).getTime(),
      );

      let mn: Date;
      let mx: Date;

      if (range === "week") {
        mn = new Date(now);
        mn.setDate(mn.getDate() - 1);
        mx = new Date(now);
        mx.setDate(mx.getDate() + 7);
      } else if (range === "2month") {
        const allDates = tasks.flatMap((t) => [
          new Date(t.startAt ?? t.createdAt),
          new Date(t.dueAt ?? t.createdAt),
        ]);
        mn = new Date(Math.min(...allDates.map((d) => d.getTime()), now.getTime()));
        mx = new Date(Math.max(...allDates.map((d) => d.getTime()), now.getTime()));
        mn.setDate(mn.getDate() - 5);
        mx.setDate(mx.getDate() + 10);
        const span = daysBetween(mn, mx);
        if (span < 60) mx.setDate(mx.getDate() + Math.ceil(60 - span));
      } else {
        const allDates = tasks.flatMap((t) => [
          new Date(t.startAt ?? t.createdAt),
          new Date(t.dueAt ?? t.createdAt),
        ]);
        mn = new Date(Math.min(...allDates.map((d) => d.getTime()), now.getTime()));
        mx = new Date(Math.max(...allDates.map((d) => d.getTime()), now.getTime()));
        mn.setDate(mn.getDate() - 2);
        mx.setDate(mx.getDate() + 3);
        const span = daysBetween(mn, mx);
        if (span < 30) mx.setDate(mx.getDate() + Math.ceil(30 - span));
      }

      const total = daysBetween(mn, mx);
      const tOffset = daysBetween(mn, now);

      const interval = range === "week" ? 1 : range === "2month" ? 14 : 7;
      const marks: Date[] = [];
      const cursor = new Date(mn);
      while (cursor <= mx) {
        marks.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + interval);
      }

      const dw = range === "week" ? 80 : range === "2month" ? 14 : 22;

      return {
        sortedTasks: sorted,
        minDate: mn,
        maxDate: mx,
        totalDays: total,
        todayOffset: tOffset,
        markers: marks,
        dayWidth: dw,
      };
    }, [tasks, range]);

  const timelineWidth = totalDays * dayWidth;

  if (tasks.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No tasks to display.
      </p>
    );
  }

  return (
    <div className="relative flex overflow-hidden">
      {/* Pinned task name column */}
      <div
        className="shrink-0 border-r border-border bg-card"
        style={{ width: TASK_COL_W, zIndex: 4 }}
      >
        <div
          className="flex items-end border-b border-border px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-text-muted"
          style={{ height: HEADER_H }}
        >
          Task
        </div>
        {sortedTasks.map((task) => {
          const status = getDisplayStatus(task);
          const isSubmitted = status === "submitted";
          const isHovered = hoveredTask === task.id;
          return (
            <div
              key={task.id}
              onClick={() => onTaskClick?.(task)}
              onMouseEnter={() => setHoveredTask(task.id)}
              onMouseLeave={() => setHoveredTask(null)}
              className={`flex cursor-pointer items-center gap-2.5 px-1 pr-2 transition-colors ${
                isHovered ? "bg-muted/50" : ""
              }`}
              style={{ height: ROW_H }}
            >
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{
                  backgroundColor: task.classColor,
                  opacity: isSubmitted ? 0.4 : 1,
                }}
              />
              <span
                className={`truncate text-[13px] ${
                  isSubmitted
                    ? "text-text-muted line-through"
                    : isHovered
                      ? "font-medium text-foreground"
                      : "text-foreground/85"
                }`}
              >
                {task.title}
              </span>
            </div>
          );
        })}
      </div>

      {/* Scrollable timeline */}
      <div ref={timelineRef} className="relative min-w-0 flex-1 overflow-x-auto">
        <div
          style={{ width: timelineWidth, minWidth: "100%" }}
          className="relative"
        >
          {/* Date headers */}
          <div
            className="relative flex items-end border-b border-border pb-2"
            style={{ height: HEADER_H }}
          >
            {markers.map((w, i) => {
              const offset = daysBetween(minDate, w);
              return (
                <div
                  key={i}
                  className="absolute whitespace-nowrap text-[10px] font-medium text-text-muted"
                  style={{ left: `${(offset / totalDays) * 100}%` }}
                >
                  {w.toLocaleDateString(
                    "en-US",
                    range === "week"
                      ? { weekday: "short", month: "short", day: "numeric" }
                      : { month: "short", day: "numeric" },
                  )}
                </div>
              );
            })}
          </div>

          {/* Today pill */}
          {todayOffset >= 0 && todayOffset <= totalDays && (
            <div
              className="absolute top-0 z-10 -translate-x-1/2 rounded bg-[#d6394c] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.04em] text-white"
              style={{ left: `${(todayOffset / totalDays) * 100}%` }}
            >
              Today
            </div>
          )}

          {/* Today vertical line */}
          {todayOffset >= 0 && todayOffset <= totalDays && (
            <div
              className="absolute z-[3] w-0.5 bg-[#d6394c] opacity-55"
              style={{
                left: `${(todayOffset / totalDays) * 100}%`,
                top: HEADER_H,
                bottom: 0,
              }}
            />
          )}

          {/* Task bars */}
          {sortedTasks.map((task) => {
            const status = getDisplayStatus(task);
            const isSubmitted = status === "submitted";
            const isOverdue = status === "overdue";
            const isHovered = hoveredTask === task.id;

            const taskStart = new Date(task.startAt ?? task.createdAt);
            const taskEnd = new Date(task.dueAt ?? task.createdAt);
            const visStart = taskStart < minDate ? minDate : taskStart;
            const visEnd = taskEnd > maxDate ? maxDate : taskEnd;

            if (visStart >= visEnd) {
              return (
                <div
                  key={task.id}
                  onClick={() => onTaskClick?.(task)}
                  onMouseEnter={() => setHoveredTask(task.id)}
                  onMouseLeave={() => setHoveredTask(null)}
                  className={`relative flex cursor-pointer items-center transition-colors ${
                    isHovered ? "bg-muted/50" : ""
                  }`}
                  style={{ height: ROW_H }}
                >
                  <span className="pl-2 text-[10px] italic text-text-muted">
                    Outside range
                  </span>
                </div>
              );
            }

            const clampedStart = daysBetween(minDate, visStart);
            const clampedDuration = daysBetween(visStart, visEnd);
            const leftPct = (clampedStart / totalDays) * 100;
            const widthPct = (clampedDuration / totalDays) * 100;
            const startsBeforeView = taskStart < minDate;
            const endsAfterView = taskEnd > maxDate;

            return (
              <div
                key={task.id}
                onClick={() => onTaskClick?.(task)}
                onMouseEnter={() => setHoveredTask(task.id)}
                onMouseLeave={() => setHoveredTask(null)}
                className={`relative flex cursor-pointer items-center transition-colors ${
                  isHovered ? "bg-muted/50" : ""
                }`}
                style={{ height: ROW_H }}
              >
                <div
                  className="absolute flex items-center overflow-hidden pl-2 transition-all duration-200"
                  style={{
                    left: `${leftPct}%`,
                    width: `${Math.max(widthPct, 1.5)}%`,
                    height: 24,
                    borderRadius: `${startsBeforeView ? 0 : 6}px ${endsAfterView ? 0 : 6}px ${endsAfterView ? 0 : 6}px ${startsBeforeView ? 0 : 6}px`,
                    background: isSubmitted
                      ? "var(--border)"
                      : isOverdue
                        ? `${task.classColor}30`
                        : `${task.classColor}28`,
                    border: isOverdue
                      ? `1.5px dashed ${task.classColor}`
                      : "none",
                    transform: isHovered ? "scaleY(1.15)" : "scaleY(1)",
                    zIndex: 1,
                  }}
                >
                  <span
                    className="whitespace-nowrap text-[10px] font-semibold"
                    style={{
                      color: isSubmitted
                        ? "var(--text-muted)"
                        : task.classColor,
                      opacity: isHovered ? 1 : 0.8,
                    }}
                  >
                    {formatDateBar(task.startAt ?? task.createdAt)} —{" "}
                    {formatDateBar(task.dueAt ?? task.createdAt)}
                    {isOverdue && " · Overdue"}
                    {isSubmitted && " · Submitted"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
