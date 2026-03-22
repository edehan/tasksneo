"use client";

import {
  ArrowLeft,
  Edit3,
  Eye,
  Loader2,
  Send,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  publishTaskDraft,
  upsertMySubmission,
  uploadTaskAttachment,
  uploadSubmissionAttachment,
  type AttachmentMeta,
} from "@/lib/api";
import { EditorToolbar } from "@/features/editor/components/editor-toolbar";
import { MarkdownPreview } from "@/features/editor/components/markdown-preview";
import { AttachmentSidebar } from "@/features/tasks/components/attachment-sidebar";

// ─── Types ───────────────────────────────────────────────────────────────────

interface EditorPageProps {
  mode: "publish" | "submit";
  classId: string;
  taskId: string;
  className: string;
  taskTitle: string;
  accentColor: string;
  initialContent?: string;
  initialAttachments?: AttachmentMeta[];
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EditorPage({
  mode,
  classId,
  taskId,
  className: clsName,
  taskTitle,
  accentColor,
  initialContent,
  initialAttachments,
}: EditorPageProps) {
  const { token } = useAuth();
  const router = useRouter();

  const [content, setContent] = useState(initialContent ?? "");
  const [attachments, setAttachments] = useState<AttachmentMeta[]>(
    initialAttachments ?? [],
  );
  const [preview, setPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync initial content if it changes (e.g. async load)
  useEffect(() => {
    if (initialContent !== undefined) setContent(initialContent);
  }, [initialContent]);

  useEffect(() => {
    if (initialAttachments !== undefined) setAttachments(initialAttachments);
  }, [initialAttachments]);

  // Set CSS variable for class accent
  useEffect(() => {
    document.documentElement.style.setProperty("--class-accent", accentColor);
    return () => {
      document.documentElement.style.removeProperty("--class-accent");
    };
  }, [accentColor]);

  // ─── Word count ──────────────────────────────────────────────────────────

  const wordCount = content.trim()
    ? content.trim().split(/\s+/).length
    : 0;

  // ─── Toolbar insert ──────────────────────────────────────────────────────

  const handleInsert = useCallback((before: string, after?: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    const suffix = after ?? "";
    const insertion = `${before}${selected}${suffix}`;

    setContent(
      (prev) => prev.substring(0, start) + insertion + prev.substring(end),
    );

    // Re-focus and set cursor after insertion
    requestAnimationFrame(() => {
      textarea.focus();
      const cursorPos = start + before.length + selected.length;
      textarea.setSelectionRange(cursorPos, cursorPos);
    });
  }, []);

  // ─── File upload ──────────────────────────────────────────────────────────

  async function uploadFiles(files: File[]) {
    if (!token || files.length === 0) return;

    setUploading(true);
    try {
      const uploadFn =
        mode === "publish" ? uploadTaskAttachment : uploadSubmissionAttachment;

      const results = await Promise.all(
        files.map((f) => uploadFn(token, taskId, f)),
      );

      setAttachments((prev) => [...prev, ...results]);
      toast.success(
        `Uploaded ${results.length} file${results.length > 1 ? "s" : ""}`,
      );
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to upload file";
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    void uploadFiles(files);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    void uploadFiles(files);
    e.target.value = "";
  }

  // ─── Submit / Publish ─────────────────────────────────────────────────────

  async function handleSubmitOrPublish() {
    if (!token) return;

    setSubmitting(true);
    try {
      if (mode === "publish") {
        await publishTaskDraft(token, taskId, {
          description: content || null,
        });
        toast.success("Task published");
      } else {
        await upsertMySubmission(token, taskId, content || null);
        toast.success("Submission saved");
      }
      router.back();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : mode === "publish"
            ? "Failed to publish task"
            : "Failed to save submission";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Labels ───────────────────────────────────────────────────────────────

  const breadcrumbLabel =
    mode === "submit"
      ? `Submitting to \u00b7 ${clsName}`
      : `Publishing in \u00b7 ${clsName}`;

  const primaryLabel = mode === "submit" ? "Submit" : "Publish Task";

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-border bg-card px-8 py-4">
        {/* Left */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-foreground"
            aria-label="Go back"
          >
            <ArrowLeft size={16} strokeWidth={2} />
          </button>

          <div className="flex flex-col">
            <span className="text-label-upper">{breadcrumbLabel}</span>
            <span className="font-serif text-base font-bold text-foreground">
              {taskTitle}
            </span>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          {/* Preview / Edit toggle */}
          <button
            type="button"
            onClick={() => setPreview(!preview)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-foreground"
          >
            {preview ? (
              <>
                <Edit3 size={13} strokeWidth={2} />
                Edit
              </>
            ) : (
              <>
                <Eye size={13} strokeWidth={2} />
                Preview
              </>
            )}
          </button>

          {/* Primary action */}
          <Button
            onClick={handleSubmitOrPublish}
            disabled={submitting}
            className="gap-2 text-white hover:opacity-90"
            style={{ backgroundColor: accentColor }}
          >
            {submitting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Send size={15} strokeWidth={2} />
            )}
            {primaryLabel}
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {/* Editor / Preview area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Toolbar (only in edit mode) */}
          {!preview && <EditorToolbar onInsert={handleInsert} />}

          {/* Content */}
          {preview ? (
            <div className="flex-1 overflow-y-auto px-8 py-7">
              <MarkdownPreview
                content={content}
                accentColor={accentColor}
              />
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your content in Markdown..."
              className="flex-1 resize-none bg-transparent px-8 py-7 font-mono text-sm leading-relaxed text-foreground placeholder:text-text-muted-soft focus:outline-none"
            />
          )}
        </div>

        {/* Attachment sidebar */}
        <div className="w-[260px] shrink-0 border-l border-border">
          <div className="flex h-full flex-col">
            {/* Drag-drop zone */}
            <div
              className={`border-b border-border p-4 ${
                dragOver ? "bg-surface-subtle" : ""
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-6 text-center transition-colors hover:border-muted-foreground hover:bg-surface-subtle">
                <Upload
                  size={20}
                  strokeWidth={1.5}
                  className="text-muted-foreground"
                />
                <span className="text-xs text-muted-foreground">
                  {uploading ? "Uploading..." : "Drop files or click to upload"}
                </span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileInputChange}
                  disabled={uploading}
                />
              </label>
            </div>

            {/* File list */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <AttachmentSidebar
                attachments={attachments}
                accentColor={accentColor}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="flex shrink-0 items-center justify-between border-t border-border px-8 py-3">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            {wordCount} {wordCount === 1 ? "word" : "words"}
          </span>
          <span className="text-text-muted-soft">&middot;</span>
          <span className="text-text-muted-soft">Markdown supported</span>
        </div>
        <span className="text-xs text-text-muted-soft">Draft saved</span>
      </footer>
    </div>
  );
}
