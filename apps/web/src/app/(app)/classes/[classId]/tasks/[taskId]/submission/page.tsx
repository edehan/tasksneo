"use client";

import {
  Bold,
  Code2,
  Eye,
  Image,
  Italic,
  Link2,
  ListOrdered,
  Save,
  Send,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import {
  filesizeLabel,
  formatDateTime,
  isOverdue,
} from "@/features/designer/format";
import { MarkdownContent } from "@/features/designer/markdown-content";
import {
  getMySubmission,
  getTask,
  type SubmissionDetail,
  type TaskDetail,
  updateTaskState,
  uploadSubmissionAttachments,
  upsertMySubmission,
} from "@/lib/api";

function ToolbarButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="taskflow-btn"
      onClick={onClick}
      style={{
        width: 32,
        height: 32,
        padding: 0,
        display: "grid",
        placeItems: "center",
      }}
      title={label}
    >
      {icon}
    </button>
  );
}

export default function SubmissionPage() {
  const params = useParams<{ classId: string; taskId: string }>();
  const taskId = params.taskId;

  const { token } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!token) return;

    let active = true;
    setLoading(true);

    void Promise.all([getTask(token, taskId), getMySubmission(token, taskId)])
      .then(([taskRes, submissionRes]) => {
        if (!active) return;

        setTask(taskRes);
        setSubmission(submissionRes);
        setContent(submissionRes?.content || "");
      })
      .catch(() => {
        if (active) {
          toast.error("加载提交页失败");
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

  const locked = useMemo(() => {
    if (!task || !submission) return false;
    return isOverdue(task.dueAt) && !task.allowLateSubmission;
  }, [task, submission]);

  function insertAtCursor(before: string, after = "") {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end) || "text";
    const next =
      content.slice(0, start) + before + selected + after + content.slice(end);
    setContent(next);

    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + before.length + selected.length + after.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  async function handleSave(type: "draft" | "submit") {
    if (!token || !task) return;

    setSaving(true);

    try {
      const updated = await upsertMySubmission(token, task.id, content || null);
      setSubmission(updated);
      await updateTaskState(token, task.id, { tags: ["submitted"] });
      toast.success(type === "submit" ? "提交成功" : "草稿已保存");
    } catch {
      toast.error(type === "submit" ? "提交失败" : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadFiles(files: FileList | null) {
    if (!token || !task || !files || files.length === 0) return;

    setUploading(true);
    try {
      const uploaded = await uploadSubmissionAttachments(
        token,
        task.id,
        Array.from(files),
      );
      setSubmission((prev) => {
        if (!prev) {
          return {
            id: "temp",
            taskId: task.id,
            userId: "",
            firstSubmittedAt: new Date().toISOString(),
            lastUpdatedAt: new Date().toISOString(),
            content,
            score: null,
            reviewerId: null,
            reviewedAt: null,
            reviewNote: null,
            attachments: uploaded,
          };
        }

        return {
          ...prev,
          attachments: uploaded,
        };
      });
      toast.success("附件上传完成");
    } catch {
      toast.error("附件上传失败");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "24px 32px", color: "var(--text-secondary)" }}>
        加载中...
      </div>
    );
  }

  if (!task) {
    return (
      <div style={{ padding: "24px 32px", color: "#c45c5c" }}>任务不存在</div>
    );
  }

  if (locked) {
    return (
      <div style={{ padding: "24px 32px", maxWidth: 760 }}>
        <div className="taskflow-surface" style={{ padding: 20 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>
            提交截止时间已过，无法修改
          </h1>
          <p style={{ marginTop: 8, color: "var(--text-secondary)" }}>
            截止时间：{formatDateTime(task.dueAt)}，当前任务不允许延迟提交。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "24px 24px 42px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 980 }}>
        <div style={{ marginBottom: 12 }}>
          <h1 style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.1 }}>
            提交：{task.title}
          </h1>
          <p
            style={{
              marginTop: 6,
              color: "var(--text-secondary)",
              fontSize: 13,
            }}
          >
            {submission ? "你已提交过内容，可继续更新" : "首次提交"}
          </p>
        </div>

        <div
          className="taskflow-surface"
          style={{ padding: 12, marginBottom: 12 }}
        >
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              marginBottom: 10,
            }}
          >
            <ToolbarButton
              label="bold"
              icon={<Bold size={14} />}
              onClick={() => insertAtCursor("**", "**")}
            />
            <ToolbarButton
              label="italic"
              icon={<Italic size={14} />}
              onClick={() => insertAtCursor("*", "*")}
            />
            <ToolbarButton
              label="list"
              icon={<ListOrdered size={14} />}
              onClick={() => insertAtCursor("1. ")}
            />
            <ToolbarButton
              label="code"
              icon={<Code2 size={14} />}
              onClick={() => insertAtCursor("`", "`")}
            />
            <ToolbarButton
              label="image"
              icon={<Image size={14} />}
              onClick={() => insertAtCursor("![alt](", ")")}
            />
            <ToolbarButton
              label="link"
              icon={<Link2 size={14} />}
              onClick={() => insertAtCursor("[", "](url)")}
            />
            <button
              type="button"
              className="taskflow-btn"
              style={{
                marginLeft: "auto",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
              onClick={() => setPreview((value) => !value)}
            >
              <Eye size={14} />
              {preview ? "编辑" : "预览"}
            </button>
          </div>

          {preview ? (
            <div
              className="taskflow-surface"
              style={{ padding: 14, minHeight: 320 }}
            >
              {content.trim() ? (
                <MarkdownContent content={content} />
              ) : (
                <p style={{ color: "var(--text-muted)" }}>暂无内容</p>
              )}
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              className="taskflow-textarea"
              rows={18}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="支持 Markdown，支持代码块。"
              style={{
                minHeight: 320,
                resize: "vertical",
                fontFamily: "var(--font-mono)",
              }}
            />
          )}
        </div>

        <div className="taskflow-surface" style={{ padding: 14 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>附件</h3>
              <p
                style={{
                  marginTop: 2,
                  color: "var(--text-secondary)",
                  fontSize: 12,
                }}
              >
                当前版本中重新上传会覆盖之前的附件
              </p>
            </div>
            <label
              className="taskflow-btn"
              style={{ cursor: uploading ? "wait" : "pointer" }}
            >
              {uploading ? "上传中..." : "上传附件"}
              <input
                type="file"
                multiple
                style={{ display: "none" }}
                disabled={uploading}
                onChange={(event) => {
                  void handleUploadFiles(event.target.files);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {submission?.attachments?.length ? (
              submission.attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="taskflow-surface"
                  style={{
                    padding: "8px 10px",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: 460,
                    }}
                  >
                    {attachment.originalName}
                  </span>
                  <span
                    style={{ fontSize: 11, color: "var(--text-secondary)" }}
                  >
                    {filesizeLabel(attachment.sizeBytes)}
                  </span>
                </div>
              ))
            ) : (
              <p style={{ color: "var(--text-muted)", fontSize: 12 }}>
                暂无附件
              </p>
            )}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 16,
            }}
          >
            <button
              type="button"
              className="taskflow-btn"
              disabled={saving}
              onClick={() => {
                void handleSave("draft");
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Save size={14} />
              保存草稿
            </button>
            <button
              type="button"
              className="taskflow-btn taskflow-btn-primary"
              disabled={saving}
              onClick={() => {
                void handleSave("submit");
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Send size={14} />
              {submission ? "更新提交" : "提交"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
