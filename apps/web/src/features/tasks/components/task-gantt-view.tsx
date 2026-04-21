"use client";

import { ZoomIn, ZoomOut } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import type { TaskWithClass } from "@/features/tasks/lib/task-utils";
import {
  type BlockedByConnector,
  isOverdue,
  sortTasksWithBlockedBy,
} from "@/features/tasks/lib/task-utils";
import { useIsMobile } from "@/hooks/use-mobile";

// ─── Constants ───────────────────────────────────────────────────────────────

const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 34;
const LABEL_WIDTH = 210;

const MIN_DAY_WIDTH = 8;
const MAX_DAY_WIDTH = 120;
export const DEFAULT_DAY_WIDTH = 22;

const MIN_SPAN_DAYS = 90;
const PADDING_DAYS = 14;

// Tick every 60 seconds so the today line drifts smoothly without excessive re-renders
const NOW_TICK_MS = 60_000;

// ─── Types ───────────────────────────────────────────────────────────────────

interface TaskGanttViewProps {
  tasks: TaskWithClass[];
  dayWidth: number;
  onDayWidthChange: (width: number) => void;
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

function getEffectiveStartDate(task: TaskWithClass): Date {
  return task.startAt ? new Date(task.startAt) : new Date(task.createdAt);
}

function getEffectiveEndDate(task: TaskWithClass, startDate: Date): Date {
  return task.dueAt
    ? new Date(task.dueAt)
    : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
}

function getEffectiveStartLabel(task: TaskWithClass): string {
  return task.startAt ?? task.createdAt;
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

// ─── Timeline Range (zoom-independent) ──────────────────────────────────────

function computeTimelineRange(tasks: TaskWithClass[]): {
  start: Date;
  end: Date;
} {
  const today = startOfDay(new Date());

  let earliest = today;
  let latest = new Date(today);
  latest.setDate(latest.getDate() + MIN_SPAN_DAYS);

  for (const task of tasks) {
    const taskStart = startOfDay(getEffectiveStartDate(task));
    const taskEnd = task.dueAt
      ? startOfDay(new Date(task.dueAt))
      : startOfDay(getEffectiveEndDate(task, taskStart));

    if (taskStart < earliest) earliest = new Date(taskStart);
    if (taskEnd > latest) latest = new Date(taskEnd);
  }

  const start = new Date(earliest);
  start.setDate(start.getDate() - PADDING_DAYS);
  const end = new Date(latest);
  end.setDate(end.getDate() + PADDING_DAYS);

  // Enforce minimum span
  const span = diffDays(start, end);
  if (span < MIN_SPAN_DAYS) {
    end.setDate(start.getDate() + MIN_SPAN_DAYS);
  }

  return { start, end };
}

// ─── Date Markers (adaptive to zoom level) ──────────────────────────────────

function computeMarkers(
  start: Date,
  end: Date,
  dayWidth: number,
  locale: string,
): { label: string; dayOffset: number }[] {
  const interval = dayWidth >= 50 ? 1 : dayWidth >= 20 ? 7 : 14;
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

// ─── Bar geometry helper ─────────────────────────────────────────────────────

interface BarGeometry {
  left: number;
  width: number;
  rowIndex: number;
}

function computeBarGeometries(
  sortedTasks: TaskWithClass[],
  timelineStart: Date,
  totalDays: number,
  dayWidth: number,
): Map<string, BarGeometry> {
  const map = new Map<string, BarGeometry>();
  for (let i = 0; i < sortedTasks.length; i++) {
    const task = sortedTasks[i];
    const barStartDate = getEffectiveStartDate(task);
    const barEndDate = getEffectiveEndDate(task, barStartDate);

    const startOffset = diffDays(timelineStart, barStartDate);
    const endOffset = diffDays(timelineStart, barEndDate);

    const left = Math.max(0, startOffset) * dayWidth;
    const right = Math.min(totalDays, endOffset) * dayWidth;
    const width = Math.max(right - left, dayWidth * 0.5);

    map.set(task.id, { left, width, rowIndex: i });
  }
  return map;
}

// ─── Connector SVG ──────────────────────────────────────────────────────────

const CONNECTOR_COLOR = "#B85A3A";

function ConnectorLines({
  connectors,
  barGeometries,
  totalWidth,
  rowCount,
}: {
  connectors: BlockedByConnector[];
  barGeometries: Map<string, BarGeometry>;
  totalWidth: number;
  rowCount: number;
}) {
  if (connectors.length === 0) return null;

  const height = rowCount * ROW_HEIGHT;

  return (
    <svg
      className="pointer-events-none absolute top-0 left-0 z-20"
      width={totalWidth}
      height={height}
      style={{ overflow: "visible" }}
      aria-hidden="true"
    >
      {/* Arrowhead marker — fixed pointing right */}
      <defs>
        <marker
          id="gantt-arrow"
          markerWidth="8"
          markerHeight="6"
          refX="0"
          refY="3"
          orient="0"
        >
          <path d="M 0 0 L 8 3 L 0 6 Z" fill={CONNECTOR_COLOR} opacity={0.75} />
        </marker>
      </defs>
      {connectors.map((c) => {
        const from = barGeometries.get(c.fromId);
        const to = barGeometries.get(c.toId);
        if (!from || !to) return null;

        // From: horizontal center of prerequisite bar, vertical center of row
        const x1 = from.left + from.width / 2;
        const y1 = from.rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
        // To: left edge of dependent bar (arrow extends inward from here)
        const x2 = to.left;
        const y2 = to.rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

        // Bezier control points for a smooth S-curve
        const midX = (x1 + x2) / 2;

        const key = `${c.fromId}-${c.toId}`;

        return (
          <path
            key={key}
            d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
            fill="none"
            stroke={CONNECTOR_COLOR}
            strokeWidth={1.5}
            opacity={0.75}
            markerEnd="url(#gantt-arrow)"
          />
        );
      })}
    </svg>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

function useNow(interval: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
}

// ─── Zoom Slider (rendered by parent) ────────────────────────────────────────

export function GanttZoomSlider({
  dayWidth,
  onDayWidthChange,
}: {
  dayWidth: number;
  onDayWidthChange: (width: number) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 self-start">
      <ZoomOut size={14} className="shrink-0 text-muted-foreground" />
      <Slider
        min={MIN_DAY_WIDTH}
        max={MAX_DAY_WIDTH}
        step={1}
        value={[dayWidth]}
        onValueChange={([v]) => onDayWidthChange(v)}
        className="w-28"
      />
      <ZoomIn size={14} className="shrink-0 text-muted-foreground" />
    </div>
  );
}

export function TaskGanttView({
  tasks,
  dayWidth,
  onDayWidthChange,
  onTaskClick,
}: TaskGanttViewProps) {
  const t = useTranslations("taskGanttView");
  const locale = useLocale();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const now = useNow(NOW_TICK_MS);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const dayWidthRef = useRef(dayWidth);
  useEffect(() => {
    dayWidthRef.current = dayWidth;
  }, [dayWidth]);

  const { tasks: sortedTasks, connectors } = useMemo(
    () => sortTasksWithBlockedBy(tasks),
    [tasks],
  );

  // Timeline range depends only on tasks (not zoom)
  const { timelineStart, totalDays } = useMemo(() => {
    const { start, end } = computeTimelineRange(tasks);
    return { timelineStart: start, totalDays: Math.ceil(diffDays(start, end)) };
  }, [tasks]);

  // Markers adapt to zoom level
  const markers = useMemo(() => {
    const end = new Date(
      timelineStart.getTime() + totalDays * 24 * 60 * 60 * 1000,
    );
    return computeMarkers(timelineStart, end, dayWidth, locale);
  }, [timelineStart, totalDays, dayWidth, locale]);

  const todayOffset = diffDays(timelineStart, now);
  const totalWidth = totalDays * dayWidth;

  // Bar geometries for connector lines
  const barGeometries = useMemo(
    () => computeBarGeometries(sortedTasks, timelineStart, totalDays, dayWidth),
    [sortedTasks, timelineStart, totalDays, dayWidth],
  );

  // Helper to access the Radix ScrollArea viewport element
  const getViewport = useCallback((): HTMLElement | null => {
    return (
      scrollRef.current?.querySelector<HTMLElement>(
        "[data-radix-scroll-area-viewport]",
      ) ?? null
    );
  }, []);

  // Zoom-to-cursor intent: stored before state update, consumed in layout effect
  const zoomIntentRef = useRef<{
    dayUnderCursor: number;
    cursorXInViewport: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!zoomIntentRef.current) return;
    const viewport = getViewport();
    if (!viewport) return;

    const { dayUnderCursor, cursorXInViewport } = zoomIntentRef.current;
    viewport.scrollLeft = dayUnderCursor * dayWidth - cursorXInViewport;
    zoomIntentRef.current = null;
  }, [dayWidth, getViewport]);

  // Unified wheel handler: horizontal scroll + Ctrl/Meta zoom
  useEffect(() => {
    const viewport = getViewport();
    if (!viewport) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // Zoom-to-cursor
        e.preventDefault();

        const rect = viewport.getBoundingClientRect();
        const cursorXInViewport = e.clientX - rect.left;
        const cursorXInContent = viewport.scrollLeft + cursorXInViewport;
        const dayUnderCursor = cursorXInContent / dayWidthRef.current;

        const zoomFactor = e.deltaY > 0 ? 0.92 : 1.08;
        const next = Math.min(
          MAX_DAY_WIDTH,
          Math.max(MIN_DAY_WIDTH, dayWidthRef.current * zoomFactor),
        );

        zoomIntentRef.current = { dayUnderCursor, cursorXInViewport };
        onDayWidthChange(next);
      } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        // Horizontal scroll from vertical wheel
        e.preventDefault();
        viewport.scrollLeft += e.deltaY;
      }
    };

    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [getViewport, onDayWidthChange]);

  // Touch pinch-to-zoom handler
  useEffect(() => {
    const viewport = getViewport();
    if (!viewport) return;

    let initialDistance = 0;
    let initialDayWidth = dayWidthRef.current;
    let centerX = 0;

    const getTouchDistance = (e: TouchEvent): number => {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        initialDistance = getTouchDistance(e);
        initialDayWidth = dayWidthRef.current;

        const rect = viewport.getBoundingClientRect();
        centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDistance > 0) {
        e.preventDefault();

        const currentDistance = getTouchDistance(e);
        const scale = currentDistance / initialDistance;
        const next = Math.min(
          MAX_DAY_WIDTH,
          Math.max(MIN_DAY_WIDTH, initialDayWidth * scale),
        );

        const rect = viewport.getBoundingClientRect();
        const cursorXInViewport =
          (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const cursorXInContent = viewport.scrollLeft + centerX;
        const dayUnderCursor = cursorXInContent / dayWidthRef.current;

        zoomIntentRef.current = { dayUnderCursor, cursorXInViewport };
        onDayWidthChange(next);
      }
    };

    const onTouchEnd = () => {
      initialDistance = 0;
    };

    viewport.addEventListener("touchstart", onTouchStart, { passive: false });
    viewport.addEventListener("touchmove", onTouchMove, { passive: false });
    viewport.addEventListener("touchend", onTouchEnd);

    return () => {
      viewport.removeEventListener("touchstart", onTouchStart);
      viewport.removeEventListener("touchmove", onTouchMove);
      viewport.removeEventListener("touchend", onTouchEnd);
    };
  }, [getViewport, onDayWidthChange]);

  // Auto-scroll to today on mount only
  const hasAutoScrolled = useRef(false);
  useEffect(() => {
    if (hasAutoScrolled.current) return;
    const viewport = getViewport();
    if (!viewport) return;

    const frame = requestAnimationFrame(() => {
      const viewportWidth = viewport.clientWidth;
      const todayPx = todayOffset * dayWidth;
      viewport.scrollLeft = Math.max(0, todayPx - viewportWidth / 5);
      hasAutoScrolled.current = true;
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
    <div
      className="flex w-full min-w-0 max-w-full overflow-hidden rounded-lg border"
      style={{ touchAction: "pan-x pan-y" }}
    >
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
      <div className="w-0 min-w-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full w-full" ref={scrollRef}>
          <div className="min-w-full" style={{ width: totalWidth }}>
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
              {isMounted && todayOffset >= 0 && todayOffset <= totalDays && (
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
              {isMounted && todayOffset >= 0 && todayOffset <= totalDays && (
                <div
                  className="absolute top-0 bottom-0 z-10"
                  style={{
                    left: todayOffset * dayWidth,
                    width: 2,
                    backgroundColor: "#d6394c",
                  }}
                />
              )}

              {/* Blocked-by connector lines */}
              <ConnectorLines
                connectors={connectors}
                barGeometries={barGeometries}
                totalWidth={totalWidth}
                rowCount={sortedTasks.length}
              />

              {/* Task rows with bars */}
              {sortedTasks.map((task) => {
                const submitted = isSubmitted(task);
                const overdue = !submitted && isOverdue(task);

                const barStartDate = getEffectiveStartDate(task);
                const barEndDate = getEffectiveEndDate(task, barStartDate);
                const startLabelIso = getEffectiveStartLabel(task);

                const startOffset = diffDays(timelineStart, barStartDate);
                const endOffset = diffDays(timelineStart, barEndDate);

                const barLeft = Math.max(0, startOffset) * dayWidth;
                const barRight = Math.min(totalDays, endOffset) * dayWidth;
                const barWidth = Math.max(barRight - barLeft, dayWidth * 0.5);
                const startLabelWidth = Math.max(0, barLeft - 4);
                const shouldShowStartLabel = startLabelWidth >= 44;

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
                            ? t("submittedCount", {
                                count: task.submittedCount,
                              })
                            : ""}
                        </span>
                      )}
                    </div>

                    {/* Desktop: date labels outside the bar */}
                    {!isMobile && (
                      <>
                        {/* Start date — left of bar when there is enough room */}
                        {shouldShowStartLabel && (
                          <span
                            className="pointer-events-none absolute flex items-center justify-end overflow-hidden font-sans text-muted-foreground"
                            style={{
                              top: 0,
                              bottom: 0,
                              left: 0,
                              width: startLabelWidth,
                              fontSize: 10,
                              fontWeight: 500,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {formatShortDate(startLabelIso, locale)}
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
    </div>
  );
}
