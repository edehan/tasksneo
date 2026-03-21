"use client";

import { Filter, Plus, Settings, Users } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { roleCanManageClass } from "@/features/designer/constants";
import { useAppShell } from "@/features/designer/context";
import { isOverdue } from "@/features/designer/format";
import { loadTasksForClasses } from "@/features/designer/task-data";
import {
  type GanttRange,
  TaskGanttView,
  TaskListView,
  type TaskViewItem,
} from "@/features/designer/task-views";

export default function ClassDashboardPage() {
  const router = useRouter();
  const params = useParams<{ classId: string }>();
  const classId = params.classId;

  const { token } = useAuth();
  const { classes, loadingClasses, openJoinDialog } = useAppShell();

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskViewItem[]>([]);
  const [view, setView] = useState<"list" | "gantt">("list");
  const [ganttRange, setGanttRange] = useState<GanttRange>("month");
  const [filter, setFilter] = useState<"all" | "notSubmitted" | "submitted">(
    "all",
  );
  const [showAllOverdue, setShowAllOverdue] = useState(false);

  const targetClass = classes.find((item) => item.id === classId) ?? null;
  const canManage = targetClass
    ? roleCanManageClass(targetClass.myRole)
    : false;

  useEffect(() => {
    if (!token || loadingClasses || !targetClass) {
      return;
    }

    let active = true;
    setLoading(true);

    void loadTasksForClasses(token, [targetClass])
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
  }, [token, targetClass, loadingClasses]);

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

  if (!loadingClasses && !targetClass) {
    return (
      <div style={{ padding: "26px 32px" }}>
        <div className="taskflow-surface" style={{ padding: 20 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>未找到班级</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>
            你可能尚未加入该班级。
          </p>
          <button
            type="button"
            className="taskflow-btn taskflow-btn-primary"
            style={{ marginTop: 14 }}
            onClick={openJoinDialog}
          >
            加入班级
          </button>
        </div>
      </div>
    );
  }

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
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 4,
                background: targetClass?.color,
                display: "inline-block",
                marginRight: 10,
              }}
            />
            {targetClass?.name ?? "班级"}
          </h1>
          <p
            style={{
              marginTop: 6,
              color: "var(--text-secondary)",
              fontSize: 14,
            }}
          >
            {targetClass?.description || "查看本班级全部任务"}
          </p>
        </div>

        {canManage ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="taskflow-btn"
              style={{ display: "flex", alignItems: "center", gap: 7 }}
              onClick={() => router.push(`/classes/${classId}/members`)}
            >
              <Users size={14} />
              成员管理
            </button>
            <button
              type="button"
              className="taskflow-btn"
              style={{ display: "flex", alignItems: "center", gap: 7 }}
              onClick={() => router.push(`/classes/${classId}/settings`)}
            >
              <Settings size={14} />
              班级设置
            </button>
            <button
              type="button"
              className="taskflow-btn taskflow-btn-primary"
              style={{ display: "flex", alignItems: "center", gap: 7 }}
              onClick={() => router.push(`/classes/${classId}/tasks/new`)}
            >
              <Plus size={14} />
              发布任务
            </button>
          </div>
        ) : null}
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
              showClass={false}
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
              该班级暂无任务
            </p>
            <div
              style={{
                marginTop: 14,
                display: "flex",
                justifyContent: "center",
                gap: 10,
              }}
            >
              {canManage ? (
                <button
                  type="button"
                  className="taskflow-btn taskflow-btn-primary"
                  onClick={() => router.push(`/classes/${classId}/tasks/new`)}
                >
                  发布任务
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
