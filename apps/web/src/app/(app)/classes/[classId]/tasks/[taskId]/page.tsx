"use client";

import { ArrowRight, Download, Pencil, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { roleCanManageClass } from "@/features/designer/constants";
import { useAppShell } from "@/features/designer/context";
import {
  filesizeLabel,
  formatDateTime,
  isOverdue,
} from "@/features/designer/format";
import { MarkdownContent } from "@/features/designer/markdown-content";
import {
  deleteTask,
  getFileUrl,
  getMySubmission,
  getTask,
  markTaskViewed,
  type SubmissionDetail,
  type TaskDetail,
} from "@/lib/api";

interface DependencyState {
  id: string;
  title: string;
  submitted: boolean;
}

export default function TaskDetailPage() {
  const params = useParams<{ classId: string; taskId: string }>();
  const classId = params.classId;
  const taskId = params.taskId;

  const router = useRouter();
  const { token } = useAuth();
  const { classes } = useAppShell();

  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [mySubmission, setMySubmission] = useState<SubmissionDetail | null>(
    null,
  );
  const [deps, setDeps] = useState<DependencyState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const targetClass = classes.find((item) => item.id === classId) ?? null;
  const canManage = targetClass
    ? roleCanManageClass(targetClass.myRole)
    : false;

  useEffect(() => {
    if (!token) return;

    let active = true;
    setLoading(true);
    setError(null);

    void Promise.all([getTask(token, taskId), getMySubmission(token, taskId)])
      .then(async ([taskDetail, my]) => {
        if (!active) return;

        setTask(taskDetail);
        setMySubmission(my);

        void markTaskViewed(token, taskId).catch(() => {
          // Silent ignore by UX requirement.
        });

        if (taskDetail.blockedBy.length === 0) {
          setDeps([]);
          return;
        }

        const depList = await Promise.all(
          taskDetail.blockedBy.map(async (depId) => {
            try {
              const [depTask, depSubmission] = await Promise.all([
                getTask(token, depId),
                getMySubmission(token, depId),
              ]);
              return {
                id: depId,
                title: depTask.title,
                submitted: Boolean(depSubmission),
              } as DependencyState;
            } catch {
              return null;
            }
          }),
        );

        if (active) {
          setDeps(
            depList.filter((item): item is DependencyState => Boolean(item)),
          );
        }
      })
      .catch(() => {
        if (active) {
          setError("任务加载失败");
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
  }, [token, taskId]);

  const dependencyState = useMemo(() => {
    if (deps.length === 0) {
      return null;
    }

    const allDone = deps.every((item) => item.submitted);
    return {
      allDone,
      text: deps.map((item) => item.title).join("、"),
    };
  }, [deps]);

  if (loading) {
    return (
      <div style={{ padding: "24px 32px", color: "var(--text-secondary)" }}>
        加载任务详情中...
      </div>
    );
  }

  if (!task || error) {
    return (
      <div style={{ padding: "24px 32px", color: "#c45c5c" }}>
        {error || "任务不存在"}
      </div>
    );
  }

  const overdue = isOverdue(task.dueAt);

  async function handleDelete() {
    if (!token || !task) return;

    const hasSubmissions = (task.stats?.submittedCount || 0) > 0;
    const message = hasSubmissions
      ? `此任务已有 ${task.stats?.submittedCount ?? 0} 份提交。删除后任务内容和附件会被清除，但提交记录保留。是否继续？`
      : "此任务将被永久删除，操作不可撤销。是否继续？";

    const confirmed = window.confirm(message);
    if (!confirmed) return;

    setDeleting(true);
    try {
      await deleteTask(token, task.id);
      router.replace(`/classes/${classId}`);
    } catch {
      window.alert("删除失败，请稍后重试");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      style={{
        padding: "28px 24px 44px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 720 }}>
        <div className="taskflow-surface" style={{ padding: "20px 22px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 4,
                    background: targetClass?.color || "var(--class-accent)",
                    display: "inline-block",
                  }}
                />
                <span
                  style={{
                    fontSize: 12,
                    color: targetClass?.color || "var(--class-accent)",
                    fontWeight: 700,
                  }}
                >
                  {targetClass?.name || task.className}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 6,
                    padding: "3px 8px",
                    color: mySubmission
                      ? "#5B8C6A"
                      : overdue
                        ? "#c45c5c"
                        : "var(--text-secondary)",
                    background: mySubmission
                      ? "color-mix(in srgb, #5B8C6A 14%, transparent)"
                      : overdue
                        ? "color-mix(in srgb, #c45c5c 14%, transparent)"
                        : "color-mix(in srgb, var(--text-secondary) 10%, transparent)",
                  }}
                >
                  {mySubmission
                    ? "已提交"
                    : overdue
                      ? "已截止"
                      : task.userState?.viewedAt
                        ? "已读"
                        : "未读"}
                </span>
              </div>
              <h1 style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.1 }}>
                {task.title}
              </h1>
              <p
                style={{
                  marginTop: 10,
                  color: overdue ? "#c45c5c" : "var(--text-secondary)",
                  fontSize: 13,
                }}
              >
                截止时间：{formatDateTime(task.dueAt)}
              </p>
            </div>

            {canManage ? (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  className="taskflow-btn"
                  onClick={() =>
                    router.push(`/classes/${classId}/tasks/${task.id}/edit`)
                  }
                  style={{ display: "flex", gap: 6, alignItems: "center" }}
                >
                  <Pencil size={14} />
                  编辑任务
                </button>
                <button
                  type="button"
                  className="taskflow-btn taskflow-btn-danger"
                  style={{ display: "flex", gap: 6, alignItems: "center" }}
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  <Trash2 size={14} />
                  {deleting ? "删除中..." : "删除任务"}
                </button>
              </div>
            ) : null}
          </div>

          {canManage && task.stats ? (
            <div
              style={{
                marginTop: 12,
                borderRadius: 9,
                border: "1px solid var(--border-color)",
                background:
                  "color-mix(in srgb, var(--class-accent) 8%, transparent)",
                padding: "9px 10px",
                color: "var(--text-secondary)",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {task.stats.memberCount} 人 · {task.stats.viewedCount} 已读 ·{" "}
              {task.stats.submittedCount} 已提交
            </div>
          ) : null}

          {dependencyState ? (
            <div
              style={{
                marginTop: 14,
                borderRadius: 8,
                border: `1px solid ${dependencyState.allDone ? "#5B8C6A" : "#C4785B"}`,
                background: dependencyState.allDone
                  ? "color-mix(in srgb, #5B8C6A 12%, transparent)"
                  : "color-mix(in srgb, #C4785B 13%, transparent)",
                padding: "10px 11px",
                fontSize: 12,
                color: dependencyState.allDone ? "#5B8C6A" : "#C4785B",
                lineHeight: 1.5,
              }}
            >
              本任务依赖前置任务：{dependencyState.text}
              {!dependencyState.allDone
                ? "。你可以先完成前置任务（当前不强制阻止提交）"
                : "。前置任务均已完成"}
            </div>
          ) : null}

          <div style={{ marginTop: 18 }}>
            <MarkdownContent content={task.description || "_暂无正文_"} />
          </div>

          {task.attachments.length > 0 ? (
            <div style={{ marginTop: 18 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
                附件
              </h3>
              <div style={{ display: "grid", gap: 8 }}>
                {task.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="taskflow-surface"
                    style={{
                      padding: "9px 10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: 440,
                        }}
                      >
                        {attachment.renamedFile || attachment.originalName}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-secondary)",
                          marginTop: 2,
                        }}
                      >
                        {filesizeLabel(attachment.sizeBytes)}
                      </div>
                    </div>
                    <a
                      href={getFileUrl(attachment.fileKey)}
                      target="_blank"
                      rel="noreferrer"
                      className="taskflow-btn"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Download size={14} />
                      下载
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div
            style={{
              marginTop: 20,
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {canManage ? (
              <button
                type="button"
                className="taskflow-btn"
                onClick={() =>
                  router.push(
                    `/classes/${classId}/tasks/${task.id}/submissions`,
                  )
                }
              >
                查看所有提交
              </button>
            ) : (
              <button
                type="button"
                className="taskflow-btn taskflow-btn-primary"
                style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
                onClick={() =>
                  router.push(`/classes/${classId}/tasks/${task.id}/submission`)
                }
              >
                {mySubmission ? "修改提交" : "去提交"}
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
