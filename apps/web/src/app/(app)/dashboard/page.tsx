"use client";

import { Filter, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { useAppShell } from "@/features/designer/context";
import { isOverdue } from "@/features/designer/format";
import { loadTasksForClasses } from "@/features/designer/task-data";
import {
  type GanttRange,
  TaskGanttView,
  TaskListView,
  type TaskViewItem,
} from "@/features/designer/task-views";

export default function DashboardPage() {
  const router = useRouter();
  const { token } = useAuth();
  const { classes, loadingClasses, openCreateDialog, openJoinDialog } =
    useAppShell();

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskViewItem[]>([]);
  const [view, setView] = useState<"list" | "gantt">("list");
  const [ganttRange, setGanttRange] = useState<GanttRange>("month");
  const [filter, setFilter] = useState<"all" | "notSubmitted" | "submitted">(
    "all",
  );
  const [showAllOverdue, setShowAllOverdue] = useState(false);

  useEffect(() => {
    if (!token || loadingClasses) {
      return;
    }

    let active = true;
    setLoading(true);

    void loadTasksForClasses(token, classes)
      .then((res) => {
        if (active) {
          setTasks(res);
        }
      })
      .catch(() => {
        if (active) {
          setTasks([]);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [token, classes, loadingClasses]);

  const filteredTasks = useMemo(() => {
    const now = new Date();

    return tasks.filter((task) => {
      if (filter === "submitted" && !task.hasSubmission) return false;
      if (filter === "notSubmitted" && task.hasSubmission) return false;

      if (showAllOverdue) return true;

      const overdue = isOverdue(task.dueAt, now);
      if (!overdue) return true;
      if (task.hasSubmission) return true;

      const dueDate = task.dueAt ? new Date(task.dueAt) : null;
      if (!dueDate || Number.isNaN(dueDate.getTime())) return false;

      const days = (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24);
      return days <= 30;
    });
  }, [tasks, filter, showAllOverdue]);

  const stats = useMemo(
    () => ({
      total: filteredTasks.length,
      submitted: filteredTasks.filter((item) => item.hasSubmission).length,
      overdue: filteredTasks.filter(
        (item) => isOverdue(item.dueAt) && !item.hasSubmission,
      ).length,
      unread: filteredTasks.filter(
        (item) => !item.hasSubmission && !item.userState?.viewedAt,
      ).length,
    }),
    [filteredTasks],
  );

  return (
    <div style={{ padding: "28px 32px 40px", maxWidth: 1100 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.1 }}>
            全部任务
          </h1>
          <p
            style={{
              marginTop: 6,
              color: "var(--text-secondary)",
              fontSize: 14,
            }}
          >
            来自所有班级的任务，按截止时间排序
          </p>
        </div>

        <button
          type="button"
          className="taskflow-btn"
          style={{ display: "flex", alignItems: "center", gap: 7 }}
          onClick={openCreateDialog}
        >
          <Plus size={14} />
          创建班级
        </button>
      </div>

      <div
        style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" }}
      >
        {[
          ["总任务", stats.total, "var(--class-accent)"],
          ["已提交", stats.submitted, "#5B8C6A"],
          ["未提交且已截止", stats.overdue, "#c45c5c"],
          ["未读", stats.unread, "var(--text-secondary)"],
        ].map(([label, value, color]) => (
          <div
            key={String(label)}
            className="taskflow-surface"
            style={{ padding: "12px 16px", minWidth: 140 }}
          >
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 26,
                color: String(color),
                fontWeight: 700,
              }}
            >
              {value}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-secondary)",
                marginTop: 2,
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>

      <div className="taskflow-surface" style={{ marginTop: 18, padding: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 6,
              background: "var(--secondary)",
              borderRadius: 9,
              padding: 3,
            }}
          >
            {[
              ["list", "列表"],
              ["gantt", "甘特图"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key as "list" | "gantt")}
                style={{
                  border: "none",
                  borderRadius: 7,
                  background: view === key ? "var(--card-bg)" : "transparent",
                  color:
                    view === key
                      ? "var(--class-accent)"
                      : "var(--text-secondary)",
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "7px 12px",
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <Filter size={14} color="var(--text-muted)" />
            {[
              ["all", "全部"],
              ["notSubmitted", "未提交"],
              ["submitted", "已提交"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className="taskflow-btn"
                style={{
                  borderColor:
                    filter === key ? "var(--class-accent)" : undefined,
                  color: filter === key ? "var(--class-accent)" : undefined,
                  background:
                    filter === key
                      ? "color-mix(in srgb, var(--class-accent) 10%, transparent)"
                      : undefined,
                }}
                onClick={() =>
                  setFilter(key as "all" | "notSubmitted" | "submitted")
                }
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              className="taskflow-btn"
              style={{
                borderColor: showAllOverdue ? "var(--class-accent)" : undefined,
                color: showAllOverdue ? "var(--class-accent)" : undefined,
                background: showAllOverdue
                  ? "color-mix(in srgb, var(--class-accent) 10%, transparent)"
                  : undefined,
              }}
              onClick={() => setShowAllOverdue((value) => !value)}
            >
              显示全部已截止
            </button>
          </div>
        </div>

        {view === "gantt" ? (
          <div
            style={{
              marginBottom: 10,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 4,
                background: "var(--secondary)",
                borderRadius: 8,
                padding: 2,
              }}
            >
              {[
                ["week", "周"],
                ["month", "1月"],
                ["twoMonths", "2月"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setGanttRange(key as GanttRange)}
                  style={{
                    border: "none",
                    borderRadius: 6,
                    background:
                      ganttRange === key ? "var(--card-bg)" : "transparent",
                    color:
                      ganttRange === key
                        ? "var(--class-accent)"
                        : "var(--text-secondary)",
                    fontSize: 11,
                    padding: "5px 10px",
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {loading ? (
          <div
            style={{
              padding: 30,
              color: "var(--text-secondary)",
              textAlign: "center",
            }}
          >
            加载任务中...
          </div>
        ) : filteredTasks.length > 0 ? (
          view === "list" ? (
            <TaskListView
              tasks={filteredTasks}
              showClass
              onOpenTask={(task) => {
                router.push(`/classes/${task.classId}/tasks/${task.id}`);
              }}
            />
          ) : (
            <TaskGanttView
              tasks={filteredTasks}
              range={ganttRange}
              onOpenTask={(task) => {
                router.push(`/classes/${task.classId}/tasks/${task.id}`);
              }}
            />
          )
        ) : (
          <div style={{ textAlign: "center", padding: "42px 12px" }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              你还没有任何待办任务
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              创建或加入班级后，任务会显示在这里
            </p>
            <div
              style={{
                marginTop: 14,
                display: "flex",
                justifyContent: "center",
                gap: 10,
              }}
            >
              <button
                type="button"
                className="taskflow-btn"
                onClick={openCreateDialog}
              >
                创建班级
              </button>
              <button
                type="button"
                className="taskflow-btn taskflow-btn-primary"
                onClick={openJoinDialog}
              >
                加入班级
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
