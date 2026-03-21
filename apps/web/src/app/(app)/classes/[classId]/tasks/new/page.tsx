"use client";

import { Sparkles } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { roleCanManageClass } from "@/features/designer/constants";
import { useAppShell } from "@/features/designer/context";
import {
  type AttachmentMeta,
  createTaskDraft,
  getTask,
  listClassTasks,
  parseTaskDraft,
  type TaskSummary,
  updateTask,
  uploadTaskAttachments,
} from "@/lib/api";

function toInputDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function toIsoOrNull(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export default function NewTaskPage() {
  const params = useParams<{ classId: string }>();
  const classId = params.classId;

  const router = useRouter();
  const { token } = useAuth();
  const { classes } = useAppShell();

  const [draftId, setDraftId] = useState<string | null>(null);
  const [rawText, setRawText] = useState("");
  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [allowLate, setAllowLate] = useState(true);
  const [blockedBy, setBlockedBy] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([]);

  const [classTasks, setClassTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [touched, setTouched] = useState<{ title?: boolean; dueAt?: boolean }>(
    {},
  );

  const targetClass = classes.find((item) => item.id === classId) ?? null;
  const canManage = targetClass
    ? roleCanManageClass(targetClass.myRole)
    : false;

  useEffect(() => {
    if (!token || !canManage) return;

    let active = true;

    void Promise.all([
      createTaskDraft(token, classId, {}),
      listClassTasks(token, classId),
    ])
      .then(([draft, tasks]) => {
        if (!active) return;

        setDraftId(draft.id);
        setTitle(draft.title || "");
        setStartAt(toInputDateTime(draft.startAt));
        setDueAt(toInputDateTime(draft.dueAt));
        setAllowLate(draft.allowLateSubmission);
        setClassTasks(tasks);
      })
      .catch(() => {
        if (active) {
          toast.error("初始化任务草稿失败");
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
  }, [token, classId, canManage]);

  const errors = useMemo(() => {
    const dueDate = dueAt ? new Date(dueAt) : null;
    const startDate = startAt ? new Date(startAt) : null;

    return {
      title: touched.title && !title.trim() ? "任务名称必填" : "",
      dueAt: touched.dueAt && !dueAt ? "截止时间必填" : "",
      dueFuture:
        touched.dueAt && dueDate && dueDate.getTime() <= Date.now()
          ? "截止时间必须晚于当前时间"
          : "",
      order:
        touched.dueAt &&
        dueDate &&
        startDate &&
        dueDate.getTime() < startDate.getTime()
          ? "截止时间不能早于开始时间"
          : "",
    };
  }, [title, startAt, dueAt, touched]);

  const canContinue =
    title.trim().length > 0 &&
    dueAt.length > 0 &&
    !errors.title &&
    !errors.dueAt &&
    !errors.dueFuture &&
    !errors.order;

  async function handleParse() {
    if (!token || !draftId || !rawText.trim()) return;

    setParsing(true);
    try {
      const parsed = await parseTaskDraft(token, draftId, rawText);
      if (parsed.title) setTitle(parsed.title);
      if (parsed.startAt) setStartAt(toInputDateTime(parsed.startAt));
      if (parsed.dueAt) setDueAt(toInputDateTime(parsed.dueAt));
      toast.success("已解析，请检查并确认");
    } catch {
      toast.error("解析失败，请手动填写");
    } finally {
      setParsing(false);
    }
  }

  async function handleAttachmentUpload(files: FileList | null) {
    if (!token || !draftId || !files || files.length === 0) return;

    setUploading(true);
    try {
      const uploaded = await uploadTaskAttachments(
        token,
        draftId,
        Array.from(files),
      );
      setAttachments((prev) => [...prev, ...uploaded]);
      toast.success("附件已上传");
    } catch {
      toast.error("附件上传失败");
    } finally {
      setUploading(false);
    }
  }

  async function handleGoEdit() {
    if (!token || !draftId) return;

    setTouched({ title: true, dueAt: true });
    if (!canContinue) return;

    setSubmitting(true);
    try {
      await updateTask(token, draftId, {
        title: title.trim(),
        sourceText: rawText || null,
        startAt: toIsoOrNull(startAt),
        dueAt: toIsoOrNull(dueAt),
        allowLateSubmission: allowLate,
        blockedBy,
      });

      if (attachments.length === 0) {
        const detail = await getTask(token, draftId);
        setAttachments(detail.attachments);
      }

      router.push(`/classes/${classId}/tasks/${draftId}/edit`);
    } catch {
      toast.error("保存草稿失败");
    } finally {
      setSubmitting(false);
    }
  }

  if (!canManage) {
    return (
      <div style={{ padding: "24px 32px", color: "#c45c5c" }}>
        你没有发布任务权限
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: "24px 32px", color: "var(--text-secondary)" }}>
        初始化任务草稿中...
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "24px 24px 40px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 820 }}>
        <h1 style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.1 }}>
          发布新任务
        </h1>

        <div
          className="taskflow-surface"
          style={{ marginTop: 14, padding: 14 }}
        >
          <label className="taskflow-label" htmlFor="raw-text">
            AI 解析区
          </label>
          <textarea
            id="raw-text"
            className="taskflow-textarea"
            rows={6}
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            placeholder="粘贴任务描述，AI 将自动提取关键信息..."
            style={{ minHeight: 120 }}
          />
          <p
            style={{
              marginTop: 6,
              color: "var(--text-secondary)",
              fontSize: 12,
            }}
          >
            支持自然语言描述，例如：下周五前提交算法作业，需要实现快速排序
          </p>

          <div
            style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}
          >
            <button
              type="button"
              className="taskflow-btn"
              disabled={!rawText.trim() || parsing}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              onClick={() => {
                void handleParse();
              }}
            >
              <Sparkles size={14} />
              {parsing ? "解析中..." : "AI 解析"}
            </button>

            <label
              className="taskflow-btn"
              style={{ cursor: uploading ? "wait" : "pointer" }}
            >
              {uploading ? "上传中..." : "提交附件"}
              <input
                type="file"
                multiple
                style={{ display: "none" }}
                disabled={uploading}
                onChange={(event) => {
                  void handleAttachmentUpload(event.target.files);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>

          {attachments.length > 0 ? (
            <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="taskflow-surface"
                  style={{ padding: "7px 9px", fontSize: 12 }}
                >
                  {attachment.originalName} ·{" "}
                  {attachment.sizeBytes
                    ? `${(attachment.sizeBytes / 1024).toFixed(1)} KB`
                    : "—"}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div
          className="taskflow-surface"
          style={{ marginTop: 12, padding: 14 }}
        >
          <div style={{ marginBottom: 12 }}>
            <label className="taskflow-label" htmlFor="task-title">
              任务名称 <span style={{ color: "#c45c5c" }}>*</span>
            </label>
            <input
              id="task-title"
              className="taskflow-input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, title: true }))}
            />
            {errors.title ? (
              <p className="taskflow-error">{errors.title}</p>
            ) : null}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
              gap: 10,
            }}
          >
            <div>
              <label className="taskflow-label" htmlFor="start-at">
                开始时间（选填）
              </label>
              <input
                id="start-at"
                className="taskflow-input"
                type="datetime-local"
                value={startAt}
                onChange={(event) => setStartAt(event.target.value)}
              />
            </div>
            <div>
              <label className="taskflow-label" htmlFor="due-at">
                截止时间 <span style={{ color: "#c45c5c" }}>*</span>
              </label>
              <input
                id="due-at"
                className="taskflow-input"
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, dueAt: true }))}
              />
              {errors.dueAt ? (
                <p className="taskflow-error">{errors.dueAt}</p>
              ) : null}
              {!errors.dueAt && errors.dueFuture ? (
                <p className="taskflow-error">{errors.dueFuture}</p>
              ) : null}
              {!errors.dueAt && !errors.dueFuture && errors.order ? (
                <p className="taskflow-error">{errors.order}</p>
              ) : null}
            </div>
          </div>

          <div
            style={{
              marginTop: 10,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <input
              id="allow-late"
              type="checkbox"
              checked={allowLate}
              onChange={(event) => setAllowLate(event.target.checked)}
            />
            <label
              htmlFor="allow-late"
              style={{ fontSize: 13, color: "var(--text-secondary)" }}
            >
              是否允许延迟提交（v1 仅存储）
            </label>
          </div>

          <div style={{ marginTop: 12 }}>
            <p className="taskflow-label">前置任务（选填）</p>
            <div
              style={{
                display: "grid",
                gap: 6,
                maxHeight: 180,
                overflowY: "auto",
                paddingRight: 3,
              }}
            >
              {classTasks
                .filter((taskItem) => taskItem.id !== draftId)
                .map((taskItem) => {
                  const checked = blockedBy.includes(taskItem.id);
                  return (
                    <label
                      key={taskItem.id}
                      className="taskflow-surface"
                      style={{
                        padding: "7px 9px",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          setBlockedBy((prev) => {
                            if (event.target.checked) {
                              return [...prev, taskItem.id];
                            }
                            return prev.filter((id) => id !== taskItem.id);
                          });
                        }}
                      />
                      {taskItem.title}
                    </label>
                  );
                })}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 16,
            }}
          >
            <button
              type="button"
              className="taskflow-btn taskflow-btn-primary"
              disabled={!canContinue || submitting}
              onClick={() => {
                void handleGoEdit();
              }}
            >
              {submitting ? "保存中..." : "编辑正文"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
