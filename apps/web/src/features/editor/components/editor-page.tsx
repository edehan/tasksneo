"use client";

import { ArrowLeft, Edit3, Eye, Loader2, Send, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { EditorToolbar } from "@/features/editor/components/editor-toolbar";
import { MarkdownPreview } from "@/features/editor/components/markdown-preview";
import { AttachmentSidebar } from "@/features/tasks/components/attachment-sidebar";
import {
  ApiError,
  type AttachmentMeta,
  deleteAttachment,
  getFileUrl,
  publishTaskDraft,
  updateTask,
  uploadSubmissionAttachment,
  uploadTaskAttachment,
  upsertMySubmission,
} from "@/lib/api";

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
  isAlreadyPublished?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EditorPage({
  mode,
  classId: _classId,
  taskId,
  className: clsName,
  taskTitle,
  accentColor,
  initialContent,
  initialAttachments,
  isAlreadyPublished,
}: EditorPageProps) {
  const t = useTranslations("editorPage");
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
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

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

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

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
      toast.success(t("toast.uploadedFiles", { count: results.length }));
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("toast.failedUploadFile");
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

  async function handleRemoveAttachment(att: AttachmentMeta) {
    if (!token) return;
    try {
      await deleteAttachment(token, att.id);
      setAttachments((prev) => prev.filter((a) => a.id !== att.id));
      toast.success(t("toast.attachmentRemoved"));
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : t("toast.failedRemoveAttachment");
      toast.error(message);
    }
  }

  // ─── Inline image upload ─────────────────────────────────────────────────

  function handleImageUploadClick() {
    imageInputRef.current?.click();
  }

  async function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !token) return;

    setUploading(true);
    try {
      const uploadFn =
        mode === "publish" ? uploadTaskAttachment : uploadSubmissionAttachment;
      const att = await uploadFn(token, taskId, file);
      setAttachments((prev) => [...prev, att]);

      // Insert markdown image at cursor position
      const textarea = textareaRef.current;
      const markdown = `![${att.originalName ?? file.name}](${getFileUrl(att.fileKey)})`;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        setContent(
          (prev) => prev.substring(0, start) + markdown + prev.substring(end),
        );
        requestAnimationFrame(() => {
          textarea.focus();
          const cursorPos = start + markdown.length;
          textarea.setSelectionRange(cursorPos, cursorPos);
        });
      } else {
        setContent((prev) => prev + markdown);
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("toast.failedUploadImage");
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  // ─── Submit / Publish ─────────────────────────────────────────────────────

  function handlePrimaryClick() {
    if (mode === "publish" && !isAlreadyPublished) {
      // New task — show confirmation before publishing
      setShowPublishConfirm(true);
    } else {
      void doSubmitOrPublish();
    }
  }

  async function doSubmitOrPublish() {
    if (!token) return;

    setSubmitting(true);
    try {
      if (mode === "publish") {
        if (isAlreadyPublished) {
          await updateTask(token, taskId, {
            description: content || null,
          });
          toast.success(t("toast.changesSaved"));
        } else {
          await publishTaskDraft(token, taskId, {
            description: content || null,
          });
          toast.success(t("toast.taskPublished"));
        }
      } else {
        await upsertMySubmission(token, taskId, content || null);
        toast.success(t("toast.submissionSaved"));
      }
      router.back();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : mode === "publish"
            ? t("toast.failedSaveTask")
            : t("toast.failedSaveSubmission");
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Labels ───────────────────────────────────────────────────────────────

  const breadcrumbLabel =
    mode === "submit"
      ? t("breadcrumb.submittingTo", { className: clsName })
      : isAlreadyPublished
        ? t("breadcrumb.editing", { className: clsName })
        : t("breadcrumb.publishingIn", { className: clsName });

  const primaryLabel =
    mode === "submit"
      ? t("primary.submit")
      : isAlreadyPublished
        ? t("primary.saveChanges")
        : t("primary.publishTask");

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
            aria-label={t("goBack")}
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
                {t("toggle.edit")}
              </>
            ) : (
              <>
                <Eye size={13} strokeWidth={2} />
                {t("toggle.preview")}
              </>
            )}
          </button>

          {/* Primary action */}
          <Button
            onClick={handlePrimaryClick}
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
          {!preview && (
            <EditorToolbar
              onInsert={handleInsert}
              onImageUpload={handleImageUploadClick}
            />
          )}

          {/* Content */}
          {preview ? (
            <div className="flex-1 overflow-y-auto px-8 py-7">
              <MarkdownPreview
                content={content}
                accentColor={accentColor}
                authToken={token ?? undefined}
              />
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("editorPlaceholder")}
              className="flex-1 resize-none bg-transparent px-8 py-7 font-mono text-sm leading-relaxed text-foreground placeholder:text-text-muted-soft focus:outline-none"
            />
          )}
        </div>

        {/* Attachment sidebar */}
        <div className="w-[260px] shrink-0 border-l border-border">
          <div className="flex h-full flex-col">
            {/* Drag-drop zone */}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: drag-drop zone for file uploads */}
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
                  {uploading ? t("uploading") : t("dropOrClickUpload")}
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
                onRemove={handleRemoveAttachment}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="flex shrink-0 items-center justify-between border-t border-border px-8 py-3">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{t("footer.wordCount", { count: wordCount })}</span>
          <span className="text-text-muted-soft">&middot;</span>
          <span className="text-text-muted-soft">
            {t("footer.markdownSupported")}
          </span>
        </div>
        <span className="text-xs text-text-muted-soft">
          {t("footer.draftSaved")}
        </span>
      </footer>

      {/* Hidden image file input */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFileChange}
      />

      {/* Publish confirmation dialog */}
      <AlertDialog
        open={showPublishConfirm}
        onOpenChange={setShowPublishConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">
              {t("publishConfirm.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("publishConfirm.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("publishConfirm.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void doSubmitOrPublish()}
              className="text-white"
              style={{ backgroundColor: accentColor }}
            >
              {t("publishConfirm.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
