"use client";

import {
  ArrowLeft,
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
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { filesizeLabel } from "@/features/designer/format";
import { MarkdownContent } from "@/features/designer/markdown-content";
import {
  type AttachmentMeta,
  getTask,
  publishTaskDraft,
  type TaskDetail,
  updateTask,
  uploadTaskAttachments,
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

export default function EditTaskPage() {
  const params = useParams<{ classId: string; taskId: string }>();
  const classId = params.classId;
  const taskId = params.taskId;

  const router = useRouter();
  const { token } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!token) return;

    let active = true;
    setLoading(true);

    void getTask(token, taskId)
      .then((result) => {
        if (!active) return;

        setTask(result);
        setContent(result.description || "");
        setAttachments(result.attachments);
      })
      .catch(() => {
        if (active) {
          toast.error("加载任务失败");
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

  async function handleUpload(files: FileList | null) {
    if (!token || !task || !files || files.length === 0) return;

    setUploading(true);
    try {
      const uploaded = await uploadTaskAttachments(
        token,
        task.id,
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

  async function handleSave() {
    if (!token || !task) return;

    setSaving(true);

    try {
      if (task.isPublished) {
        await updateTask(token, task.id, { description: content || null });
        toast.success("保存修改成功");
      } else {
        await publishTaskDraft(token, task.id, {
          description: content || null,
          title: task.title,
        });
        toast.success("任务已发布");
      }
      router.replace(`/classes/${classId}/tasks/${task.id}`);
    } catch {
      toast.error(task.isPublished ? "保存失败" : "发布失败");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "24px 32px", color: "var(--text-secondary)" }}>
        加载任务中...
      </div>
    );
  }

  if (!task) {
    return (
      <div style={{ padding: "24px 32px", color: "#c45c5c" }}>任务不存在</div>
    );
  }

  return (
    <div
      style={{
        padding: "20px 20px 36px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 1040 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 10,
          }}
        >
          <button
            type="button"
            className="taskflow-btn"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            onClick={() => router.back()}
          >
            <ArrowLeft size={14} />
            返回
          </button>

          <button
            type="button"
            className="taskflow-btn taskflow-btn-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            disabled={saving || !content.trim()}
            onClick={() => {
              void handleSave();
            }}
          >
            {task.isPublished ? <Save size={14} /> : <Send size={14} />}
            {saving ? "处理中..." : task.isPublished ? "保存修改" : "发布任务"}
          </button>
        </div>

        <div
          className="taskflow-surface"
          style={{ padding: 14, marginBottom: 12 }}
        >
          <h1 style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1 }}>
            {task.title}
          </h1>
          <p
            style={{
              marginTop: 6,
              color: "var(--text-secondary)",
              fontSize: 12,
            }}
          >
            {task.isPublished ? "编辑任务正文" : "草稿任务，发布后成员可见"}
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr minmax(220px, 280px)",
            gap: 12,
          }}
        >
          <div className="taskflow-surface" style={{ padding: 12 }}>
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
                  display: "inline-flex",
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
                style={{ padding: 14, minHeight: 380 }}
              >
                {content.trim() ? (
                  <MarkdownContent content={content} />
                ) : (
                  <p style={{ color: "var(--text-muted)" }}>暂无正文</p>
                )}
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                className="taskflow-textarea"
                rows={20}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                style={{
                  minHeight: 380,
                  resize: "vertical",
                  fontFamily: "var(--font-mono)",
                }}
                placeholder="支持 Markdown"
              />
            )}
          </div>

          <div className="taskflow-surface" style={{ padding: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>附件</h3>
              <label
                className="taskflow-btn"
                style={{ cursor: uploading ? "wait" : "pointer" }}
              >
                {uploading ? "上传中..." : "上传"}
                <input
                  type="file"
                  multiple
                  style={{ display: "none" }}
                  disabled={uploading}
                  onChange={(event) => {
                    void handleUpload(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>

            <div
              style={{
                display: "grid",
                gap: 8,
                maxHeight: 420,
                overflowY: "auto",
              }}
            >
              {attachments.length > 0 ? (
                attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="taskflow-surface"
                    style={{ padding: "8px 9px" }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {attachment.originalName}
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
                ))
              ) : (
                <p style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  暂无附件
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
