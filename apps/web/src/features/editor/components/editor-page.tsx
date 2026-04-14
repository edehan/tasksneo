"use client";

import {
  ArrowLeft,
  Clock,
  Edit3,
  Eye,
  Loader2,
  Mic,
  Paperclip,
  Send,
  Sparkles,
  Undo2,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";

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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { EditorToolbar } from "@/features/editor/components/editor-toolbar";
import { MarkdownPreview } from "@/features/editor/components/markdown-preview";
import { AttachmentSidebar } from "@/features/tasks/components/attachment-sidebar";
import { useStreamingTranscription } from "@/hooks/use-streaming-transcription";
import {
  ApiError,
  type AttachmentMeta,
  deleteAttachment,
  getFileUrl,
  publishTaskDraft,
  reviseTaskContent,
  updateAttachmentVisibility,
  updateTask,
  uploadSubmissionAttachment,
  uploadTaskAttachment,
  upsertMySubmission,
} from "@/lib/api";
import { webDataKeys } from "@/lib/web-data-keys";

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
  initialDueAt?: string;
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
  isAlreadyPublished,
  initialDueAt,
}: EditorPageProps) {
  const t = useTranslations("editorPage");
  const { user } = useAuth();
  const router = useRouter();
  const { mutate } = useSWRConfig();

  const [content, setContent] = useState(initialContent ?? "");
  const [attachments, setAttachments] = useState<AttachmentMeta[]>(
    initialAttachments ?? [],
  );
  const [preview, setPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [showMobileAttachments, setShowMobileAttachments] = useState(false);

  // AI Rewrite dialog
  const [showRewriteDialog, setShowRewriteDialog] = useState(false);
  const [rewriteInstruction, setRewriteInstruction] = useState("");
  const [revising, setRevising] = useState(false);
  const {
    isConnecting: rewriteConnecting,
    isStreaming: rewriteStreaming,
    transcript: rewriteTranscript,
    partialText: rewritePartialText,
    startStreaming: rewriteStartStreaming,
    stopStreaming: rewriteStopStreaming,
    resetTranscript: rewriteResetTranscript,
  } = useStreamingTranscription();

  // Undo stack
  const [contentHistory, setContentHistory] = useState<string[]>([]);

  // Extend deadline
  const [dueAt, setDueAt] = useState<Date | null>(
    initialDueAt ? new Date(initialDueAt) : null,
  );
  const [showExtendDialog, setShowExtendDialog] = useState(false);
  const [extendMode, setExtendMode] = useState<
    "1h" | "3h" | "1d" | "3d" | "custom"
  >("1d");
  const [customAmount, setCustomAmount] = useState("1");
  const [customUnit, setCustomUnit] = useState<"hours" | "days">("days");
  const [extending, setExtending] = useState(false);

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
    if (!user || files.length === 0) return;

    setUploading(true);
    try {
      const uploadFn =
        mode === "publish" ? uploadTaskAttachment : uploadSubmissionAttachment;

      const results = await Promise.all(files.map((f) => uploadFn(taskId, f)));

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
    if (!user) return;
    try {
      await deleteAttachment(att.id);
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

  async function handleToggleAttachmentVisibility(att: AttachmentMeta) {
    if (!user || mode !== "publish") return;
    try {
      const updated = await updateAttachmentVisibility(att.id, !att.isVisible);
      setAttachments((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
      toast.success(t("toast.attachmentVisibilityUpdated"));
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : t("toast.failedToggleAttachmentVisibility");
      toast.error(message);
    }
  }

  // ─── Inline image upload ─────────────────────────────────────────────────

  function handleImageUploadClick() {
    imageInputRef.current?.click();
  }

  function insertImageMarkdown(att: AttachmentMeta) {
    const textarea = textareaRef.current;
    const markdown = `![${att.originalName}](${getFileUrl(att.fileKey)})`;
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
  }

  function handleInsertAttachmentImage(att: AttachmentMeta) {
    const isImage =
      att.mimeType?.toLowerCase().startsWith("image/") ||
      /\.(png|jpe?g|gif|svg|webp|bmp)$/i.test(att.originalName);
    if (!isImage) {
      return;
    }
    insertImageMarkdown(att);
  }

  async function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;

    setUploading(true);
    try {
      const att =
        mode === "publish"
          ? await uploadTaskAttachment(taskId, file, {
              isVisible: false,
            })
          : await uploadSubmissionAttachment(taskId, file);
      setAttachments((prev) => [...prev, att]);

      insertImageMarkdown({
        ...att,
        originalName: att.originalName ?? file.name,
      });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("toast.failedUploadImage");
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  // ─── AI Rewrite ────────────────────────────────────────────────────────────

  // Sync streaming transcript into rewrite instruction
  const prevRewriteTranscriptRef = useRef("");
  useEffect(() => {
    if (
      rewriteTranscript &&
      rewriteTranscript !== prevRewriteTranscriptRef.current
    ) {
      const newText = rewriteTranscript
        .slice(prevRewriteTranscriptRef.current.length)
        .trim();
      if (newText) {
        setRewriteInstruction((prev) =>
          prev ? `${prev} ${newText}` : newText,
        );
      }
      prevRewriteTranscriptRef.current = rewriteTranscript;
    }
  }, [rewriteTranscript]);

  async function handleRewriteSubmit() {
    if (!user || !rewriteInstruction.trim() || revising) return;

    setRevising(true);
    try {
      // Save current content for undo
      setContentHistory((prev) => [...prev, content]);

      const result = await reviseTaskContent(
        taskId,
        content,
        rewriteInstruction.trim(),
      );
      setContent(result.revisedContent);
      toast.success(t("toast.revised"));
      setShowRewriteDialog(false);
      setRewriteInstruction("");
      rewriteResetTranscript();
      prevRewriteTranscriptRef.current = "";
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("toast.failedRevise");
      toast.error(message);
    } finally {
      setRevising(false);
    }
  }

  function handleUndo() {
    if (contentHistory.length === 0) return;
    const prev = contentHistory[contentHistory.length - 1];
    setContentHistory((h) => h.slice(0, -1));
    setContent(prev);
  }

  // ─── Extend deadline ──────────────────────────────────────────────────────

  function getExtendedDate(): Date | null {
    if (!dueAt) return null;

    const result = new Date(dueAt);
    let hours = 0;

    if (extendMode === "custom") {
      const amount = Number.parseFloat(customAmount);
      if (Number.isNaN(amount) || amount <= 0) return null;
      hours = customUnit === "days" ? amount * 24 : amount;
    } else {
      const presets: Record<string, number> = {
        "1h": 1,
        "3h": 3,
        "1d": 24,
        "3d": 72,
      };
      hours = presets[extendMode] ?? 0;
    }

    result.setTime(result.getTime() + hours * 60 * 60 * 1000);
    return result;
  }

  async function handleExtendDeadline() {
    if (!user || !dueAt) return;
    const newDueAt = getExtendedDate();
    if (!newDueAt || newDueAt <= dueAt) return;

    setExtending(true);
    try {
      await updateTask(taskId, { dueAt: newDueAt.toISOString() });
      setDueAt(newDueAt);
      setShowExtendDialog(false);
      toast.success(t("toast.deadlineExtended"));
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("toast.failedExtendDeadline");
      toast.error(message);
    } finally {
      setExtending(false);
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
    if (!user) return;

    setSubmitting(true);
    try {
      if (mode === "publish") {
        if (isAlreadyPublished) {
          await updateTask(taskId, {
            description: content || null,
          });
          toast.success(t("toast.changesSaved"));
        } else {
          await publishTaskDraft(taskId, {
            description: content || null,
          });
          toast.success(t("toast.taskPublished"));
        }
        await Promise.all([
          mutate(webDataKeys.classTasks(classId)),
          mutate(webDataKeys.task(taskId)),
          mutate(webDataKeys.myTasks()),
        ]);
      } else {
        await upsertMySubmission(taskId, content || null);
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

  const mobileAttachmentButtonLabel = t("manageAttachments");
  const mobileAttachmentLabel = t("attachmentsPanel", {
    count: attachments.length,
  });

  const secondaryActionClass =
    "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-foreground md:px-3.5 md:py-1.5";

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="shrink-0 border-b border-border bg-card px-4 py-3 md:px-8 md:py-4">
        <div className="flex items-start justify-between gap-4 md:items-center">
          {/* Left */}
          <div className="flex min-w-0 flex-1 items-start gap-3 md:items-center md:gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-foreground"
              aria-label={t("goBack")}
            >
              <ArrowLeft size={16} strokeWidth={2} />
            </button>

            <div className="min-w-0 flex-1">
              <span className="text-label-upper">{breadcrumbLabel}</span>
              <span className="mt-1 block break-words font-serif text-sm font-bold text-foreground md:text-base">
                {taskTitle}
              </span>
            </div>
          </div>

          {/* Desktop actions */}
          <div className="hidden items-center justify-end gap-3 md:flex md:flex-wrap">
            {contentHistory.length > 0 && (
              <button
                type="button"
                onClick={handleUndo}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-foreground"
              >
                <Undo2 size={13} strokeWidth={2} />
                {t("undo")}
              </button>
            )}

            {mode === "publish" && (
              <button
                type="button"
                onClick={() => setShowRewriteDialog(true)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-foreground"
              >
                <Sparkles size={13} strokeWidth={2} />
                {t("aiRewrite")}
              </button>
            )}

            {mode === "publish" && dueAt && (
              <button
                type="button"
                onClick={() => setShowExtendDialog(true)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-foreground"
              >
                <Clock size={13} strokeWidth={2} />
                {t("extendDeadline")}
              </button>
            )}

            <button
              type="button"
              onClick={() => setPreview(!preview)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-foreground"
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

            <Button
              onClick={handlePrimaryClick}
              disabled={submitting}
              className="shrink-0 gap-2 text-white hover:opacity-90"
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
        </div>

        {/* Mobile secondary actions */}
        <div className="-mx-4 mt-3 overflow-x-auto px-4 pb-1 md:hidden">
          <div className="flex min-w-max items-center gap-2">
            {contentHistory.length > 0 && (
              <button
                type="button"
                onClick={handleUndo}
                className={secondaryActionClass}
              >
                <Undo2 size={13} strokeWidth={2} />
                {t("undo")}
              </button>
            )}

            {mode === "publish" && (
              <button
                type="button"
                onClick={() => setShowRewriteDialog(true)}
                className={secondaryActionClass}
              >
                <Sparkles size={13} strokeWidth={2} />
                {t("aiRewrite")}
              </button>
            )}

            {mode === "publish" && dueAt && (
              <button
                type="button"
                onClick={() => setShowExtendDialog(true)}
                className={secondaryActionClass}
              >
                <Clock size={13} strokeWidth={2} />
                {t("extendDeadline")}
              </button>
            )}

            <button
              type="button"
              onClick={() => setPreview(!preview)}
              className={secondaryActionClass}
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
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col pb-32 md:flex-row md:pb-0">
        {/* Editor / Preview area */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Toolbar (only in edit mode) */}
          {!preview && (
            <EditorToolbar
              onInsert={handleInsert}
              onImageUpload={handleImageUploadClick}
            />
          )}

          {/* Content */}
          {preview ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-7">
              <MarkdownPreview content={content} accentColor={accentColor} />
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("editorPlaceholder")}
              className="min-h-0 flex-1 resize-none bg-transparent px-4 py-5 font-mono text-sm leading-relaxed text-foreground placeholder:text-text-muted-soft focus:outline-none md:px-8 md:py-7"
            />
          )}
        </div>

        {/* Attachment sidebar */}
        <div className="hidden w-[260px] shrink-0 border-l border-border md:block">
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
                onInsertImage={handleInsertAttachmentImage}
                onToggleVisibility={
                  mode === "publish"
                    ? handleToggleAttachmentVisibility
                    : undefined
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 px-4 py-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur supports-[backdrop-filter]:bg-card/90 md:static md:shrink-0 md:bg-background md:px-8 md:shadow-none"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)",
        }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground md:gap-4">
            <span>{t("footer.wordCount", { count: wordCount })}</span>
            <span className="hidden text-text-muted-soft md:inline">
              &middot;
            </span>
            <span className="hidden text-text-muted-soft md:inline">
              {t("footer.markdownSupported")}
            </span>
            <span className="text-text-muted-soft md:hidden">
              {t("footer.draftSaved")}
            </span>
          </div>
          <span className="hidden text-xs text-text-muted-soft md:inline">
            {t("footer.draftSaved")}
          </span>
          <div className="grid grid-cols-2 gap-3 md:hidden">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowMobileAttachments(true)}
              className="h-11 justify-between rounded-2xl px-4 text-foreground"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Paperclip size={15} strokeWidth={2} />
                <span className="truncate">{mobileAttachmentButtonLabel}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                {attachments.length}
              </span>
            </Button>
            <Button
              onClick={handlePrimaryClick}
              disabled={submitting}
              className="h-11 rounded-2xl text-white hover:opacity-90"
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
        </div>
      </footer>

      <Sheet
        open={showMobileAttachments}
        onOpenChange={setShowMobileAttachments}
      >
        <SheetContent
          side="bottom"
          className="max-h-[80dvh] rounded-t-[24px] px-0 pb-0"
        >
          <SheetHeader className="px-4 pb-3 pt-1 text-left">
            <SheetTitle className="font-serif text-base">
              {mobileAttachmentLabel}
            </SheetTitle>
            <SheetDescription>
              {t("attachmentsSheetDescription")}
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 overflow-y-auto">
            {/* biome-ignore lint/a11y/noStaticElementInteractions: drag-drop zone for file uploads */}
            <div
              className={`border-y border-border p-4 ${
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

            <AttachmentSidebar
              attachments={attachments}
              accentColor={accentColor}
              onRemove={handleRemoveAttachment}
              onInsertImage={handleInsertAttachmentImage}
              onToggleVisibility={
                mode === "publish"
                  ? handleToggleAttachmentVisibility
                  : undefined
              }
            />
          </div>
        </SheetContent>
      </Sheet>

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

      {/* AI Rewrite dialog */}
      <Dialog
        open={showRewriteDialog}
        onOpenChange={(open) => {
          setShowRewriteDialog(open);
          if (!open) {
            rewriteStopStreaming();
            setRewriteInstruction("");
            rewriteResetTranscript();
            prevRewriteTranscriptRef.current = "";
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {t("rewriteDialog.title")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <textarea
              value={
                rewriteInstruction +
                (rewritePartialText ? ` ${rewritePartialText}` : "")
              }
              onChange={(e) => setRewriteInstruction(e.target.value)}
              placeholder={t("rewriteDialog.placeholder")}
              className="w-full resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-text-muted-soft focus:outline-none focus:ring-1 focus:ring-ring"
              style={{ minHeight: 100 }}
              disabled={revising}
            />

            <div className="flex items-center justify-between">
              {/* Voice input toggle */}
              <button
                type="button"
                onClick={() => {
                  if (rewriteStreaming || rewriteConnecting) {
                    rewriteStopStreaming();
                  } else if (user) {
                    void rewriteStartStreaming();
                  }
                }}
                disabled={revising}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  rewriteStreaming
                    ? "border-destructive bg-destructive/10 text-destructive"
                    : rewriteConnecting
                      ? "border-border bg-muted text-foreground"
                      : "border-border text-muted-foreground hover:bg-surface-subtle hover:text-foreground"
                }`}
              >
                {rewriteStreaming ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                    </span>
                    {t("rewriteDialog.stop")}
                  </>
                ) : rewriteConnecting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    {t("rewriteDialog.connecting")}
                  </>
                ) : (
                  <>
                    <Mic size={13} strokeWidth={2} />
                    {t("rewriteDialog.voiceInput")}
                  </>
                )}
              </button>

              {/* Submit button */}
              <Button
                onClick={() => void handleRewriteSubmit()}
                disabled={revising || !rewriteInstruction.trim()}
                className="gap-2 px-6 text-white hover:opacity-90"
                style={{ backgroundColor: accentColor }}
              >
                {revising ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Sparkles size={15} strokeWidth={2} />
                )}
                {revising
                  ? t("rewriteDialog.submitting")
                  : t("rewriteDialog.submit")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Extend deadline dialog */}
      <AlertDialog open={showExtendDialog} onOpenChange={setShowExtendDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">
              {t("extendDialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("extendDialog.currentDeadline")}:{" "}
              {dueAt?.toLocaleString() ?? "—"}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-2">
            {/* Preset buttons */}
            <div className="flex flex-wrap gap-2">
              {(["1h", "3h", "1d", "3d", "custom"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setExtendMode(key)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    extendMode === key
                      ? "text-white"
                      : "border-border text-muted-foreground hover:bg-surface-subtle"
                  }`}
                  style={
                    extendMode === key
                      ? {
                          backgroundColor: accentColor,
                          borderColor: accentColor,
                        }
                      : undefined
                  }
                >
                  {key === "custom"
                    ? t("extendDialog.custom")
                    : t(`extendDialog.presets.${key}`)}
                </button>
              ))}
            </div>

            {/* Custom input */}
            {extendMode === "custom" && (
              <div className="flex items-center gap-3">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">{t("extendDialog.amount")}</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="h-8"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">&nbsp;</Label>
                  <div className="flex gap-1">
                    {(["hours", "days"] as const).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setCustomUnit(u)}
                        className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                          customUnit === u
                            ? "text-white"
                            : "border-border text-muted-foreground hover:bg-surface-subtle"
                        }`}
                        style={
                          customUnit === u
                            ? {
                                backgroundColor: accentColor,
                                borderColor: accentColor,
                              }
                            : undefined
                        }
                      >
                        {t(`extendDialog.unit.${u}`)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* New deadline preview */}
            {(() => {
              const newDate = getExtendedDate();
              if (!newDate) return null;
              return (
                <p className="text-sm text-foreground">
                  {t("extendDialog.newDeadline")}:{" "}
                  <span className="font-medium">
                    {newDate.toLocaleString()}
                  </span>
                </p>
              );
            })()}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>{t("extendDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExtendDeadline}
              disabled={extending || !getExtendedDate()}
              className="text-white"
              style={{ backgroundColor: accentColor }}
            >
              {extending && <Loader2 size={14} className="mr-1 animate-spin" />}
              {t("extendDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
