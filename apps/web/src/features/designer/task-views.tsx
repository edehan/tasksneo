"use client";

import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

import {
  daysBetween,
  formatDateShort,
  formatDateTime,
  isOverdue,
  pickTaskStartAt,
} from "@/features/designer/format";
import type { TaskSummary } from "@/lib/api";

export interface TaskViewItem extends TaskSummary {
  classColor: string;
  classNameResolved: string;
  hasSubmission: boolean;
}

function statusForTask(task: TaskViewItem) {
  if (task.hasSubmission) {
    return {
      label: "已提交",
      color: "#5B8C6A",
      bg: "color-mix(in srgb, #5B8C6A 14%, transparent)",
    };
  }

  if (isOverdue(task.dueAt)) {
    return {
      label: "已截止",
      color: "#c45c5c",
      bg: "color-mix(in srgb, #c45c5c 14%, transparent)",
    };
  }

  if (task.userState?.viewedAt) {
    return {
      label: "已读",
      color: "#5886A5",
      bg: "color-mix(in srgb, #5886A5 14%, transparent)",
    };
  }

  return {
    label: "未读",
    color: "var(--text-secondary)",
    bg: "color-mix(in srgb, var(--text-secondary) 10%, transparent)",
  };
}

function TaskRow({
  task,
  showClass,
  onOpen,
}: {
  task: TaskViewItem;
  showClass: boolean;
  onOpen: (task: TaskViewItem) => void;
}) {
  const status = statusForTask(task);
  const overdue = isOverdue(task.dueAt);

  return (
    <button
      type="button"
      onClick={() => onOpen(task)}
      style={{
        width: "100%",
        border: "none",
        borderBottom: "1px solid var(--border-color)",
        background: "transparent",
        cursor: "pointer",
        textAlign: "left",
        display: "grid",
        gridTemplateColumns: showClass
          ? "2.2fr 1.2fr 1.1fr 96px"
          : "2.4fr 1.2fr 1.1fr 96px",
        gap: 10,
        padding: "12px 10px",
        alignItems: "center",
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background =
          "color-mix(in srgb, var(--class-accent) 7%, transparent)";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = "transparent";
      }}
    >
      <div
        style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            background: task.classColor,
            flexShrink: 0,
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              color:
                overdue && !task.hasSubmission
                  ? "#c45c5c"
                  : "var(--text-primary)",
              textDecoration: task.hasSubmission ? "line-through" : "none",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {task.title}
          </div>
          {showClass ? (
            <div
              style={{
                fontSize: 11,
                color: "var(--text-secondary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {task.classNameResolved}
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        {formatDateTime(task.startAt || task.createdAt)}
      </div>
      <div
        style={{
          fontSize: 12,
          color:
            overdue && !task.hasSubmission
              ? "#c45c5c"
              : "var(--text-secondary)",
        }}
      >
        {formatDateTime(task.dueAt)}
      </div>
      <span
        style={{
          justifySelf: "start",
          fontSize: 11,
          fontWeight: 600,
          borderRadius: 6,
          padding: "3px 8px",
          color: status.color,
          background: status.bg,
        }}
      >
        {status.label}
      </span>
    </button>
  );
}

export function TaskListView({
  tasks,
  showClass,
  onOpenTask,
}: {
  tasks: TaskViewItem[];
  showClass: boolean;
  onOpenTask: (task: TaskViewItem) => void;
}) {
  const [showOverdue, setShowOverdue] = useState(false);

  const activeTasks = tasks.filter((task) => !isOverdue(task.dueAt));
  const overdueTasks = tasks.filter((task) => isOverdue(task.dueAt));

  return (
    <div style={{ borderTop: "1px solid var(--border-color)" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: showClass
            ? "2.2fr 1.2fr 1.1fr 96px"
            : "2.4fr 1.2fr 1.1fr 96px",
          gap: 10,
          padding: "10px",
          borderBottom: "1px solid var(--border-color)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--text-muted)",
          fontWeight: 700,
        }}
      >
        <span>任务</span>
        <span>开始时间</span>
        <span>截止时间</span>
        <span>状态</span>
      </div>

      {activeTasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          showClass={showClass}
          onOpen={onOpenTask}
        />
      ))}

      {overdueTasks.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setShowOverdue((show) => !show)}
            style={{
              width: "100%",
              border: "none",
              background: "transparent",
              borderBottom: showOverdue
                ? "1px solid var(--border-color)"
                : "none",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px",
              color: "var(--text-secondary)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            <ChevronDown
              size={16}
              style={{
                transform: showOverdue ? "rotate(0deg)" : "rotate(-90deg)",
                transition: "transform 0.15s",
              }}
            />
            已截止任务（{overdueTasks.length}）
          </button>

          {showOverdue
            ? overdueTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  showClass={showClass}
                  onOpen={onOpenTask}
                />
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}

export type GanttRange = "week" | "month" | "twoMonths";

const ROW_HEIGHT = 42;
const HEADER_HEIGHT = 34;

export function TaskGanttView({
  tasks,
  range,
  onOpenTask,
}: {
  tasks: TaskViewItem[];
  range: GanttRange;
  onOpenTask: (task: TaskViewItem) => void;
}) {
  const now = new Date();

  const sorted = useMemo(
    () =>
      [...tasks].sort(
        (a, b) =>
          new Date(a.dueAt || a.createdAt).getTime() -
          new Date(b.dueAt || b.createdAt).getTime(),
      ),
    [tasks],
  );

  const scale = range === "week" ? 72 : range === "twoMonths" ? 14 : 24;

  const [minDate, maxDate] = useMemo(() => {
    if (sorted.length === 0) {
      const start = new Date(now);
      const end = new Date(now);
      end.setDate(end.getDate() + 30);
      return [start, end] as const;
    }

    const starts = sorted.map((task) =>
      new Date(
        pickTaskStartAt(task.startAt, task.createdAt) || task.createdAt,
      ).getTime(),
    );
    const ends = sorted.map((task) =>
      new Date(task.dueAt || task.createdAt).getTime(),
    );

    const min = new Date(Math.min(...starts, now.getTime()));
    const max = new Date(Math.max(...ends, now.getTime()));

    if (range === "week") {
      min.setDate(min.getDate() - 2);
      max.setDate(max.getDate() + 7);
    } else if (range === "twoMonths") {
      min.setDate(min.getDate() - 8);
      max.setDate(max.getDate() + 12);
    } else {
      min.setDate(min.getDate() - 4);
      max.setDate(max.getDate() + 8);
    }

    return [min, max] as const;
  }, [sorted, now, range]);

  const totalDays = Math.max(daysBetween(minDate, maxDate), 1);
  const timelineWidth = Math.ceil(totalDays * scale);
  const todayOffset = daysBetween(minDate, now) * scale;

  const markerStep = range === "week" ? 1 : range === "twoMonths" ? 14 : 7;
  const markers = useMemo(() => {
    const list: Date[] = [];
    const current = new Date(minDate);
    while (current <= maxDate) {
      list.push(new Date(current));
      current.setDate(current.getDate() + markerStep);
    }
    return list;
  }, [minDate, maxDate, markerStep]);

  const rowIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    sorted.forEach((item, index) => {
      map.set(item.id, index);
    });
    return map;
  }, [sorted]);

  return (
    <div
      style={{
        display: "flex",
        overflow: "hidden",
        borderTop: "1px solid var(--border-color)",
      }}
    >
      <div
        style={{
          width: 250,
          flexShrink: 0,
          borderRight: "1px solid var(--border-color)",
          background: "var(--card-bg)",
          zIndex: 2,
        }}
      >
        <div
          style={{
            height: HEADER_HEIGHT,
            borderBottom: "1px solid var(--border-color)",
            color: "var(--text-muted)",
            fontSize: 10,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            padding: "0 10px",
          }}
        >
          任务
        </div>

        {sorted.map((task) => (
          <button
            key={task.id}
            type="button"
            onClick={() => onOpenTask(task)}
            style={{
              width: "100%",
              height: ROW_HEIGHT,
              border: "none",
              borderBottom: "1px solid var(--border-color)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0 10px",
              cursor: "pointer",
              textAlign: "left",
              background: "transparent",
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.background =
                "color-mix(in srgb, var(--class-accent) 8%, transparent)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = "transparent";
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: task.classColor,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontSize: 13,
                color: "var(--text-primary)",
              }}
            >
              {task.title}
            </span>
          </button>
        ))}
      </div>

      <div style={{ overflowX: "auto", overflowY: "hidden", flex: 1 }}>
        <div style={{ width: timelineWidth, position: "relative" }}>
          <div
            style={{
              height: HEADER_HEIGHT,
              borderBottom: "1px solid var(--border-color)",
              position: "relative",
              background: "var(--card-bg)",
            }}
          >
            {markers.map((marker) => {
              const left = daysBetween(minDate, marker) * scale;
              return (
                <div
                  key={marker.toISOString()}
                  style={{
                    position: "absolute",
                    left,
                    top: 0,
                    bottom: 0,
                    borderLeft: "1px solid var(--border-color)",
                    width: 0,
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 8,
                      left: 6,
                      fontSize: 10,
                      color: "var(--text-muted)",
                    }}
                  >
                    {formatDateShort(marker.toISOString())}
                  </span>
                </div>
              );
            })}
          </div>

          <div
            style={{ position: "relative", height: sorted.length * ROW_HEIGHT }}
          >
            {sorted.map((task, index) => {
              const rowTop = index * ROW_HEIGHT;
              const start =
                pickTaskStartAt(task.startAt, task.createdAt) || task.createdAt;
              const end = task.dueAt || task.createdAt;
              const startOffset = daysBetween(minDate, start) * scale;
              const endOffset = daysBetween(minDate, end) * scale;
              const width = Math.max(endOffset - startOffset, 8);

              return (
                <div
                  key={task.id}
                  style={{
                    position: "absolute",
                    top: rowTop,
                    left: 0,
                    right: 0,
                    height: ROW_HEIGHT,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: 0,
                      borderBottom: "1px solid var(--border-color)",
                      height: ROW_HEIGHT,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => onOpenTask(task)}
                    style={{
                      position: "absolute",
                      left: startOffset,
                      top: 9,
                      width,
                      height: 24,
                      border: "none",
                      borderRadius: 8,
                      background: task.classColor,
                      opacity: 0.88,
                      cursor: "pointer",
                    }}
                    title={`${task.title} · ${formatDateTime(start)} - ${formatDateTime(end)}`}
                  />
                </div>
              );
            })}

            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: todayOffset,
                width: 2,
                background: "#c45c5c",
                opacity: 0.85,
              }}
            />

            <svg
              width={timelineWidth}
              height={sorted.length * ROW_HEIGHT}
              style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
              aria-hidden="true"
              focusable="false"
            >
              <defs>
                <marker
                  id="taskflow-arrow"
                  markerWidth="6"
                  markerHeight="6"
                  refX="4"
                  refY="3"
                  orient="auto-start-reverse"
                >
                  <path d="M0,0 L0,6 L6,3 z" fill="var(--text-muted)" />
                </marker>
              </defs>

              {sorted.flatMap((task) => {
                const targetIndex = rowIndexMap.get(task.id);
                if (targetIndex === undefined || task.blockedBy.length === 0)
                  return [];

                const targetStart =
                  pickTaskStartAt(task.startAt, task.createdAt) ||
                  task.createdAt;
                const targetX = daysBetween(minDate, targetStart) * scale;
                const targetY = targetIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

                return task.blockedBy.flatMap((depId) => {
                  const sourceIndex = rowIndexMap.get(depId);
                  if (sourceIndex === undefined) return [];

                  const sourceTask = sorted[sourceIndex];
                  const sourceEnd = sourceTask.dueAt || sourceTask.createdAt;
                  const sourceX = daysBetween(minDate, sourceEnd) * scale;
                  const sourceY = sourceIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
                  const midX = sourceX + 12;

                  return (
                    <path
                      key={`${task.id}-${depId}`}
                      d={`M ${sourceX} ${sourceY} L ${midX} ${sourceY} L ${midX} ${targetY} L ${targetX} ${targetY}`}
                      stroke="var(--text-muted)"
                      strokeWidth="1"
                      fill="none"
                      markerEnd="url(#taskflow-arrow)"
                    />
                  );
                });
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
