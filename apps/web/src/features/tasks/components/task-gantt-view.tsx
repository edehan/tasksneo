"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { TaskWithClass } from "@/features/tasks/lib/task-utils";
import { isOverdue, sortTasksByDue } from "@/features/tasks/lib/task-utils";
import { useIsMobile } from "@/hooks/use-mobile";

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

function formatShortDate(iso: string, locale: string): string {
  const d = new Date(iso);
  const month = d.toLocaleString(locale, { month: "short" });
  const day = d.getDate();
  return `${month} ${day}`;
}

function formatMarkerDate(d: Date, locale: string): string {
  const month = d.toLocaleString(locale, { month: "short" }).toUpperCase();
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
    const taskEnd = task.dueAt ? startOfDay(new Date(task.dueAt)) : taskStart;

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
  locale: string,
): { label: string; dayOffset: number }[] {
  const interval = range === "week" ? 1 : range === "month" ? 7 : 14;
  const markers: { label: string; dayOffset: number }[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    const offset = diffDays(start, cursor);
    markers.push({
      label: formatMarkerDate(cursor, locale),
      dayOffset: offset,
    });
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
  const t = useTranslations("taskGanttView");
  const locale = useLocale();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const dayWidth = DAY_WIDTHS[ganttRange];

  const sortedTasks = useMemo(() => sortTasksByDue(tasks), [tasks]);

  const { timelineStart, totalDays, markers } = useMemo(() => {
    const { start, end } = computeTimelineRange(tasks, ganttRange);
    const total = Math.ceil(diffDays(start, end));
    const m = computeMarkers(start, end, ganttRange, locale);
    return { timelineStart: start, totalDays: total, markers: m };
  }, [tasks, ganttRange, locale]);

  const todayOffset = diffDays(timelineStart, startOfDay(new Date()));
  const totalWidth = totalDays * dayWidth;

  // Helper to access the Radix ScrollArea viewport element
  const getViewport = useCallback((): HTMLElement | null => {
    return (
      scrollRef.current?.querySelector<HTMLElement>(
        "[data-radix-scroll-area-viewport]",
      ) ?? null
    );
  }, []);

  // Feature 1: Wheel-to-horizontal-scroll
  useEffect(() => {
    const viewport = getViewport();
    if (!viewport) return;

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        viewport.scrollLeft += e.deltaY;
      }
    };

    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [getViewport]);

  // Feature 3: Auto-scroll to today on mount / range change
  useEffect(() => {
    const viewport = getViewport();
    if (!viewport) return;

    const frame = requestAnimationFrame(() => {
      const viewportWidth = viewport.clientWidth;
      const todayPx = todayOffset * dayWidth;
      viewport.scrollLeft = Math.max(0, todayPx - viewportWidth / 5);
    });

    return () => cancelAnimationFrame(frame);
  }, [dayWidth, todayOffset, getViewport]);

  if (tasks.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("noTasks")}
      </p>
    );
  }

  return (
    <div className="flex overflow-hidden rounded-lg border">
      {/* Left: pinned task column (hidden on mobile) */}
      {!isMobile && (
        <div
          className="shrink-0 border-r bg-card"
          style={{ width: LABEL_WIDTH }}
        >
          {/* Header spacer */}
          <div className="border-b" style={{ height: HEADER_HEIGHT }} />
          {/* Task rows */}
          {sortedTasks.map((task) => {
            const submitted = isSubmitted(task);
            return (
              // biome-ignore lint/a11y/noStaticElementInteractions: clickable gantt row
              // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard nav not applicable for gantt chart
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
      )}

      {/* Right: scrollable timeline */}
      <ScrollArea className="min-w-0 flex-1" ref={scrollRef}>
        <div style={{ width: totalWidth, minWidth: "100%" }}>
          {/* Header with date markers */}
          <div className="relative border-b" style={{ height: HEADER_HEIGHT }}>
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
                {t("today")}
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
            {sortedTasks.map((task) => {
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

              const barLeft = Math.max(0, startOffset) * dayWidth;
              const barRight = Math.min(totalDays, endOffset) * dayWidth;
              const barWidth = Math.max(barRight - barLeft, dayWidth * 0.5);
              const barDays = endOffset - Math.max(0, startOffset);

              // Submission progress: submittedCount / (memberCount - 1), owner excluded
              const eligible = Math.max(task.memberCount - 1, 1);
              const progress = Math.min(task.submittedCount / eligible, 1);

              // Bar colors: track = medium opacity, filled progress = deeper
              const barBg = submitted ? "#c0b8ad30" : `${task.classColor}30`;
              const fillBg = submitted ? "#c0b8ad60" : `${task.classColor}60`;
              const barBorder = overdue
                ? `1px dashed ${task.classColor}`
                : "none";

              // Bar label color (for mobile task title)
              const labelColor = submitted ? "#c0b8ad" : task.classColor;

              return (
                // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard nav not applicable for gantt chart
                // biome-ignore lint/a11y/noStaticElementInteractions: clickable gantt bar
                <div
                  key={task.id}
                  className="group relative cursor-pointer border-b transition-colors duration-150 hover:bg-surface-subtle"
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => onTaskClick?.(task)}
                >
                  {/* Bar (track) */}
                  <div
                    className="absolute top-1/2 rounded-sm transition-transform duration-150 group-hover:scale-y-[1.15]"
                    style={{
                      left: barLeft,
                      width: barWidth,
                      height: ROW_HEIGHT - 16,
                      transform: "translateY(-50%)",
                      backgroundColor: barBg,
                      border: barBorder,
                      borderRadius: 4,
                      overflow: "hidden",
                    }}
                  >
                    {/* Progress fill */}
                    {progress > 0 && (
                      <div
                        className="absolute inset-y-0 left-0"
                        style={{
                          width: `${progress * 100}%`,
                          backgroundColor: fillBg,
                          borderRadius: "inherit",
                        }}
                      />
                    )}
                    {/* Mobile: show task title inside bar */}
                    {isMobile ? (
                      <span
                        className="pointer-events-none absolute inset-0 z-10 flex items-center truncate px-1.5 font-sans font-medium"
                        style={{
                          fontSize: 11,
                          color: labelColor,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {task.title}
                      </span>
                    ) : (
                      /* Desktop: submission count inside bar, right-aligned */
                      <span
                        className="pointer-events-none absolute inset-0 z-10 flex items-center justify-end truncate px-1.5 font-sans"
                        style={{
                          fontSize: 10,
                          fontWeight: 500,
                          color: labelColor,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {task.submittedCount > 0
                          ? t("submittedCount", { count: task.submittedCount })
                          : ""}
                      </span>
                    )}
                  </div>

                  {/* Desktop: date labels outside the bar */}
                  {!isMobile && (
                    <>
                      {/* Start date — left of bar, only for bars >= 2 days */}
                      {task.startAt && barDays >= 2 && (
                        <span
                          className="pointer-events-none absolute flex items-center justify-end overflow-hidden font-sans text-muted-foreground"
                          style={{
                            top: 0,
                            bottom: 0,
                            left: 0,
                            width: Math.max(0, barLeft - 4),
                            fontSize: 10,
                            fontWeight: 500,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatShortDate(task.startAt, locale)}
                        </span>
                      )}
                      {/* Due date — right of bar */}
                      {task.dueAt && (
                        <span
                          className="pointer-events-none absolute flex items-center overflow-hidden font-sans text-muted-foreground"
                          style={{
                            top: 0,
                            bottom: 0,
                            left: barLeft + barWidth + 4,
                            width: Math.max(
                              0,
                              totalWidth - (barLeft + barWidth + 4),
                            ),
                            fontSize: 10,
                            fontWeight: 500,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatShortDate(task.dueAt, locale)}
                        </span>
                      )}
                    </>
                  )}
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
