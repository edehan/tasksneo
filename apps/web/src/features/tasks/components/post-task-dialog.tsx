"use client";

import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Mic,
  Paperclip,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useStreamingTranscription } from "@/hooks/use-streaming-transcription";
import {
  ApiError,
  type AttachmentMeta,
  createTaskDraft,
  deleteTask,
  getMyClassDraft,
  listClassTasks,
  type ParseTimeOption,
  parseTaskDraft,
  type TaskSummary,
  updateTask,
  uploadTaskAttachment,
} from "@/lib/api";
import { getClipboardImageFiles } from "@/lib/clipboard-images";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PostTaskDialogProps {
  classId: string;
  className: string;
  themeColor: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditBody: (data: { taskId: string; title: string }) => void;
}

const FORCE_LATE_SUBMISSION_THRESHOLD_MS = 5 * 60 * 1000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatOptionDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(locale, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function isDocxFile(file: File): boolean {
  return /\.docx$/i.test(file.name);
}

function toMarkdownFileName(fileName: string): string {
  return fileName.replace(/\.docx$/i, ".md");
}

async function convertDocxToMarkdownFile(file: File): Promise<File> {
  const mammoth = await import("mammoth");
  const { extractRawText, images } = mammoth;
  const convertToMarkdown = (
    mammoth as unknown as {
      convertToMarkdown?: (
        input: { arrayBuffer: ArrayBuffer },
        options?: {
          convertImage?: unknown;
        },
      ) => Promise<{ value: string }>;
    }
  ).convertToMarkdown;

  const arrayBuffer = await file.arrayBuffer();
  let markdown = "";

  if (convertToMarkdown) {
    const result = await convertToMarkdown(
      { arrayBuffer },
      {
        // Avoid huge base64 payloads in markdown while preserving image placeholders.
        convertImage: images.imgElement(() =>
          Promise.resolve({
            src: "embedded-image",
            alt: "image",
          }),
        ),
      },
    );
    markdown = result.value.trim();
  }

  if (!markdown) {
    const text = await extractRawText({ arrayBuffer });
    markdown = text.value.trim();
  }

  if (!markdown) {
    markdown = file.name;
  }

  return new File([markdown], toMarkdownFileName(file.name), {
    type: "text/markdown;charset=utf-8",
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PostTaskDialog({
  classId,
  className: clsName,
  themeColor,
  open,
  onOpenChange,
  onEditBody,
}: PostTaskDialogProps) {
  const t = useTranslations("postTaskDialog");
  const locale = useLocale();
  const { user } = useAuth();

  // Form state
  const [rawText, setRawText] = useState("");
  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState<Date | undefined>(undefined);
  const [dueAt, setDueAt] = useState<Date | undefined>(undefined);
  const [allowLate, setAllowLate] = useState(false);
  const [blockedBy, setBlockedBy] = useState<string[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Attachments — real uploads
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([]);
  const [uploading, setUploading] = useState(false);

  // Draft tracking
  const [draftId, setDraftId] = useState<string | null>(null);
  const draftIdRef = useRef<string | null>(null);

  // UI state
  const [expanded, setExpanded] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);
  const [attempted, setAttempted] = useState(false);

  // Time option selection (when AI returns multiple)
  const [pendingTimeOptions, setPendingTimeOptions] = useState<
    ParseTimeOption[] | null
  >(null);

  // Prerequisites
  const [classTasks, setClassTasks] = useState<TaskSummary[]>([]);
  const [prereqOpen, setPrereqOpen] = useState(false);

  // Voice streaming transcription
  const {
    isConnecting,
    isStreaming,
    transcript,
    partialText,
    startStreaming,
    stopStreaming,
    resetTranscript,
  } = useStreamingTranscription();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const rawTextAreaRef = useRef<HTMLTextAreaElement>(null);

  // Sync streaming transcript into rawText
  const prevTranscriptRef = useRef("");
  useEffect(() => {
    if (transcript && transcript !== prevTranscriptRef.current) {
      const newText = transcript.slice(prevTranscriptRef.current.length).trim();
      if (newText) {
        setRawText((prev) => (prev ? `${prev} ${newText}` : newText));
        if (parsed) setParsed(false);
      }
      prevTranscriptRef.current = transcript;
    }
  }, [transcript, parsed]);

  // Keep ref in sync
  useEffect(() => {
    draftIdRef.current = draftId;
  }, [draftId]);

  // ─── Load existing draft on dialog open ─────────────────────────────────

  useEffect(() => {
    if (!open || !user || draftId) return;

    getMyClassDraft(classId)
      .then((draft) => {
        if (!draft) return;
        setDraftId(draft.id);
        draftIdRef.current = draft.id;
        setTitle(draft.title || "");
        setRawText(draft.sourceText || "");
        if (draft.startAt) setStartAt(new Date(draft.startAt));
        if (draft.dueAt) setDueAt(new Date(draft.dueAt));
        setAllowLate(draft.allowLateSubmission);
        setBlockedBy(draft.blockedBy ?? []);
        setAttachments(
          (draft.attachments ?? []).filter((att) => att.isVisible),
        );
        if (draft.title || draft.dueAt) setExpanded(true);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user, classId, draftId]);

  // ─── Load class tasks for prerequisites ─────────────────────────────────

  useEffect(() => {
    if (!open || !user) return;
    listClassTasks(classId)
      .then((tasks) => setClassTasks(tasks.filter((t) => t.id !== draftId)))
      .catch(() => {});
  }, [open, user, classId, draftId]);

  // If dialog is closed externally (overlay click / ESC / parent state change),
  // force-stop streaming so browser recording indicator is cleared.
  useEffect(() => {
    if (!open && isStreaming) {
      stopStreaming();
    }
  }, [open, isStreaming, stopStreaming]);

  // ─── Validation ──────────────────────────────────────────────────────────

  const titleValid = title.trim().length > 0;
  const dueAtValid = !!dueAt;
  const datesValid = !startAt || !dueAt || dueAt >= startAt;
  const dueAtMs = dueAt?.getTime();
  const lateSubmissionForced =
    dueAtMs !== undefined &&
    !Number.isNaN(dueAtMs) &&
    dueAtMs - nowMs < FORCE_LATE_SUBMISSION_THRESHOLD_MS;
  const effectiveAllowLate = allowLate || lateSubmissionForced;
  const formValid = titleValid && dueAtValid && datesValid;

  useEffect(() => {
    if (!open || !dueAt) return;

    setNowMs(Date.now());
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 15_000);

    return () => window.clearInterval(intervalId);
  }, [open, dueAt]);

  useEffect(() => {
    if (lateSubmissionForced && !allowLate) {
      setAllowLate(true);
    }
  }, [lateSubmissionForced, allowLate]);

  // ─── Lazy draft creation ─────────────────────────────────────────────────

  const ensureDraft = useCallback(async (): Promise<string> => {
    if (draftIdRef.current) return draftIdRef.current;
    if (!user) throw new Error(t("errors.notAuthenticated"));

    const draft = await createTaskDraft(classId, {
      title: title.trim() || t("untitledTask"),
      sourceText: rawText.trim() || null,
      startAt: startAt ? startAt.toISOString() : null,
      dueAt: dueAt ? dueAt.toISOString() : null,
      allowLateSubmission: effectiveAllowLate,
      blockedBy,
    });
    setDraftId(draft.id);
    draftIdRef.current = draft.id;
    return draft.id;
  }, [
    user,
    classId,
    title,
    rawText,
    startAt,
    dueAt,
    effectiveAllowLate,
    blockedBy,
    t,
  ]);

  // ─── Reset ─────────────────────────────────────────────────────────────

  const resetForm = useCallback(() => {
    setRawText("");
    setTitle("");
    setStartAt(undefined);
    setDueAt(undefined);
    setAllowLate(false);
    setBlockedBy([]);
    setAttachments([]);
    setUploading(false);
    setDraftId(null);
    draftIdRef.current = null;
    setExpanded(false);
    setParsing(false);
    setParsed(false);
    setSubmitting(false);
    setTitleTouched(false);
    setAttempted(false);
    setPendingTimeOptions(null);
    setClassTasks([]);
    resetTranscript();
    prevTranscriptRef.current = "";
  }, [resetTranscript]);

  // ─── AI Parse ──────────────────────────────────────────────────────────

  function applyTimeOption(opt: ParseTimeOption) {
    if (opt.startAt) {
      try {
        setStartAt(new Date(opt.startAt));
      } catch {
        /* invalid date */
      }
    }
    if (opt.dueAt) {
      try {
        setDueAt(new Date(opt.dueAt));
      } catch {
        /* invalid date */
      }
    }
  }

  async function handleAiParse() {
    if (!user || parsing || parsed) return;

    const hasText = rawText.trim().length > 0;
    const hasAttachments = attachments.length > 0;
    if (!hasText && !hasAttachments) return;

    setParsing(true);
    try {
      const taskId = await ensureDraft();

      const result = await parseTaskDraft(taskId, rawText.trim() || undefined);

      if (result.title) setTitle(result.title);
      if (result.allowLateSubmission !== null) {
        setAllowLate(result.allowLateSubmission);
      }

      const options = result.timeOptions ?? [];
      if (options.length > 1) {
        setPendingTimeOptions(options);
      } else if (options.length === 1) {
        applyTimeOption(options[0]);
      }

      setParsed(true);
      setExpanded(true);
      toast.success(t("toast.aiParsed"));
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("toast.failedParseTask");
      toast.error(message);
    } finally {
      setParsing(false);
    }
  }

  // ─── File upload ───────────────────────────────────────────────────────

  async function uploadFiles(
    fileArray: File[],
    options: { isVisible?: boolean } = {},
  ) {
    if (fileArray.length === 0 || !user) return;
    setUploading(true);
    try {
      const taskId = await ensureDraft();
      const visibleAttachments: AttachmentMeta[] = [];
      const isVisible = options.isVisible ?? true;

      for (const file of fileArray) {
        const visible = await uploadTaskAttachment(taskId, file, {
          isVisible,
        });
        visibleAttachments.push(visible);

        if (isDocxFile(file)) {
          try {
            const hiddenMarkdown = await convertDocxToMarkdownFile(file);
            await uploadTaskAttachment(taskId, hiddenMarkdown, {
              isVisible: false,
            });
          } catch (err) {
            console.error("Failed to convert DOCX to hidden markdown", err);
          }
        }
      }

      setAttachments((prev) => [...prev, ...visibleAttachments]);
      if (parsed) setParsed(false);
      toast.success(
        t("toast.uploadedFiles", { count: visibleAttachments.length }),
      );
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("toast.failedUploadFile");
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;
    e.target.value = "";

    await uploadFiles(Array.from(files));
  }

  function insertRawTextAtSelection(
    text: string,
    selection: { start: number; end: number },
  ) {
    setRawText(
      (prev) =>
        prev.substring(0, selection.start) +
        text +
        prev.substring(selection.end),
    );
    if (parsed) setParsed(false);

    requestAnimationFrame(() => {
      const textarea = rawTextAreaRef.current;
      if (!textarea) return;
      const cursorPos = selection.start + text.length;
      textarea.focus();
      textarea.setSelectionRange(cursorPos, cursorPos);
    });
  }

  function handleRawTextPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (!user) return;

    const imageFiles = getClipboardImageFiles(e.clipboardData);
    if (imageFiles.length === 0) return;

    e.preventDefault();

    const pastedText = e.clipboardData.getData("text/plain");
    if (pastedText) {
      insertRawTextAtSelection(pastedText, {
        start: e.currentTarget.selectionStart,
        end: e.currentTarget.selectionEnd,
      });
    } else if (parsed) {
      setParsed(false);
    }

    void uploadFiles(imageFiles, { isVisible: false });
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    if (parsed) setParsed(false);
  }

  // ─── Submit (Create/Update Draft → Edit Body) ──────────────────────────

  async function handleEditBody() {
    if (!user) return;
    if (!formValid) {
      setAttempted(true);
      setExpanded(true);
      return;
    }

    setSubmitting(true);
    try {
      let taskId: string;

      const taskData = {
        title: title.trim(),
        sourceText: rawText.trim() || null,
        startAt: startAt ? startAt.toISOString() : null,
        dueAt: dueAt ? dueAt.toISOString() : null,
        allowLateSubmission: effectiveAllowLate,
        blockedBy,
      };

      if (draftIdRef.current) {
        // Draft already exists — update it with latest form state
        await updateTask(draftIdRef.current, taskData);
        taskId = draftIdRef.current;
      } else {
        // Create new draft
        const draft = await createTaskDraft(classId, taskData);
        taskId = draft.id;
      }

      onOpenChange(false);
      onEditBody({ taskId, title: title.trim() });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("toast.failedCreateDraft");
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Clear draft ────────────────────────────────────────────────────────

  async function handleClear() {
    if (draftIdRef.current && user) {
      try {
        await deleteTask(draftIdRef.current);
      } catch {
        /* draft may already be deleted */
      }
    }
    resetForm();
  }

  // ─── Prerequisite helpers ──────────────────────────────────────────────

  function togglePrereq(taskId: string) {
    setBlockedBy((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId],
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          stopStreaming();
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2.5 font-serif text-base font-semibold">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: themeColor }}
            />
            {t("title", { className: clsName })}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {/* Textarea area */}
          <div className="rounded-lg border border-border bg-background">
            <textarea
              ref={rawTextAreaRef}
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                if (parsed) setParsed(false);
              }}
              onPaste={handleRawTextPaste}
              placeholder={t("inputPlaceholder")}
              className="w-full resize-none rounded-t-lg bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-text-muted-soft focus:outline-none"
              style={{ minHeight: 130 }}
            />

            {/* Bottom bar */}
            <div className="flex items-center gap-2 border-t border-border px-3 py-2">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />

              {/* Attach */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-foreground disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 size={13} strokeWidth={2} className="animate-spin" />
                ) : (
                  <Paperclip size={13} strokeWidth={2} />
                )}
                {uploading ? t("uploading") : t("attach")}
              </button>

              {/* Voice Streaming */}
              <button
                type="button"
                onClick={() => {
                  if (isStreaming || isConnecting) {
                    stopStreaming();
                  } else if (user) {
                    void startStreaming();
                  }
                }}
                disabled={uploading || parsing}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                  isStreaming
                    ? "border-destructive bg-destructive/10 text-destructive"
                    : isConnecting
                      ? "border-border bg-muted text-foreground"
                      : "border-border text-muted-foreground hover:bg-surface-subtle hover:text-foreground"
                }`}
              >
                {isStreaming ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                    </span>
                    {t("stopRecording")}
                  </>
                ) : isConnecting ? (
                  <>
                    <Loader2
                      size={13}
                      strokeWidth={2}
                      className="animate-spin"
                    />
                    {t("connecting")}
                  </>
                ) : (
                  <>
                    <Mic size={13} strokeWidth={2} />
                    {t("record")}
                  </>
                )}
              </button>

              {/* Expand Form */}
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-foreground"
              >
                {expanded ? (
                  <ChevronUp size={13} strokeWidth={2} />
                ) : (
                  <ChevronDown size={13} strokeWidth={2} />
                )}
                {expanded ? t("collapse") : t("expandForm")}
              </button>

              {/* AI Parse — visible when any input exists */}
              {(rawText.trim().length > 0 || attachments.length > 0) && (
                <button
                  type="button"
                  onClick={handleAiParse}
                  disabled={uploading || parsing || parsed}
                  className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                    parsed
                      ? "border border-border bg-muted text-muted-foreground"
                      : "text-white"
                  }`}
                  style={
                    !parsed
                      ? {
                          background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)`,
                          boxShadow: `0 2px 8px ${themeColor}40`,
                        }
                      : undefined
                  }
                >
                  {parsing ? (
                    <Loader2
                      size={13}
                      strokeWidth={2}
                      className="animate-spin"
                    />
                  ) : parsed ? (
                    <Check size={13} strokeWidth={2} />
                  ) : (
                    <Sparkles size={13} strokeWidth={2} />
                  )}
                  {parsing ? t("parsing") : parsed ? t("parsed") : t("aiParse")}
                </button>
              )}
            </div>
          </div>

          {/* Partial transcript indicator */}
          {partialText && (
            <div className="mt-2 px-1">
              <span className="text-xs text-muted-foreground italic">
                {partialText}
              </span>
            </div>
          )}

          {/* Attachment chips */}
          {attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {attachments.map((att) => (
                <span
                  key={att.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground"
                >
                  <Paperclip
                    size={11}
                    strokeWidth={2}
                    className="text-muted-foreground"
                  />
                  <span className="max-w-[120px] truncate">
                    {att.originalName}
                  </span>
                  <span className="text-muted-foreground">
                    {formatFileSize(att.sizeBytes ?? 0)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    className="ml-0.5 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X size={11} strokeWidth={2} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Time option picker — shown when AI returns multiple options */}
          {pendingTimeOptions && pendingTimeOptions.length > 1 && (
            <div className="mt-3 rounded-lg border border-border bg-background p-4">
              <p className="mb-2.5 text-sm font-medium text-foreground">
                {t("timeOptions.title")}
              </p>
              <div className="flex flex-col gap-2">
                {pendingTimeOptions.map((opt, i) => (
                  <button
                    // biome-ignore lint/suspicious/noArrayIndexKey: time option list from AI parsing
                    key={i}
                    type="button"
                    onClick={() => {
                      applyTimeOption(opt);
                      setPendingTimeOptions(null);
                    }}
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-surface-subtle"
                  >
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: themeColor }}
                    />
                    <span className="text-foreground">
                      {formatOptionDate(opt.startAt, locale)} →{" "}
                      {formatOptionDate(opt.dueAt, locale)}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPendingTimeOptions(null)}
                  className="px-3 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t("timeOptions.none")}
                </button>
              </div>
            </div>
          )}

          {/* Expandable form */}
          <div
            className="overflow-hidden transition-all duration-300 ease-in-out"
            style={{
              maxHeight: expanded ? 600 : 0,
              opacity: expanded ? 1 : 0,
            }}
          >
            <div className="pt-5">
              <span className="text-label-upper mb-3 block">
                {t("taskDetails")}
              </span>

              {/* Title */}
              <div className="mb-4 space-y-1.5">
                <Label htmlFor="post-task-title" className="text-sm">
                  {t("taskTitle")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="post-task-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => setTitleTouched(true)}
                  placeholder={t("taskTitlePlaceholder")}
                  className={
                    (titleTouched || attempted) && !titleValid
                      ? "border-destructive focus-visible:ring-destructive"
                      : ""
                  }
                />
                {(titleTouched || attempted) && !titleValid && (
                  <p className="text-xs text-destructive">
                    {t("titleRequired")}
                  </p>
                )}
              </div>

              {/* Dates */}
              <div className="mb-4 flex gap-3">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-sm">{t("startDate")}</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <DateTimePicker
                        value={startAt}
                        onChange={setStartAt}
                        placeholder={t("optional")}
                        disabled={submitting}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setStartAt(new Date())}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-foreground"
                    >
                      <Clock size={11} strokeWidth={2} />
                      {t("now")}
                    </button>
                  </div>
                  <p className="text-xs text-text-muted-soft">
                    {t("startDateHint")}
                  </p>
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label className="text-sm">
                    {t("dueDate")} <span className="text-destructive">*</span>
                  </Label>
                  <DateTimePicker
                    value={dueAt}
                    onChange={(v) => {
                      setDueAt(v);
                      if (v) setAttempted(false);
                    }}
                    placeholder={t("selectDueDate")}
                    disabled={submitting}
                    className={
                      attempted && !dueAtValid
                        ? "border-destructive focus-visible:ring-destructive"
                        : ""
                    }
                  />
                  {attempted && !dueAtValid && (
                    <p className="text-xs text-destructive">
                      {t("dueDateRequired")}
                    </p>
                  )}
                  {startAt && dueAt && !datesValid && (
                    <p className="text-xs text-destructive">
                      {t("dueDateAfterStart")}
                    </p>
                  )}
                </div>
              </div>

              {/* Allow late */}
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-pressed={effectiveAllowLate}
                      aria-disabled={lateSubmissionForced}
                      onClick={() => {
                        if (lateSubmissionForced) return;
                        setAllowLate((prev) => !prev);
                      }}
                      className={`mb-4 flex items-center gap-2 text-left ${
                        lateSubmissionForced ? "cursor-help" : "cursor-pointer"
                      }`}
                    >
                      <div
                        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-all duration-150"
                        style={{
                          borderColor: effectiveAllowLate
                            ? themeColor
                            : undefined,
                          backgroundColor: effectiveAllowLate
                            ? themeColor
                            : "transparent",
                        }}
                      >
                        {effectiveAllowLate && (
                          <Check
                            size={11}
                            strokeWidth={3}
                            className="text-white"
                          />
                        )}
                      </div>
                      <span className="text-sm text-foreground">
                        {t("allowLateSubmission")}
                      </span>
                    </button>
                  </TooltipTrigger>
                  {lateSubmissionForced && (
                    <TooltipContent side="top">
                      {t("lateSubmissionForcedHint")}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>

              {/* Prerequisites */}
              {classTasks.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-sm">{t("prerequisites")}</Label>
                  <Popover open={prereqOpen} onOpenChange={setPrereqOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <span className="text-muted-foreground">
                          {blockedBy.length === 0
                            ? t("selectPrerequisites")
                            : t("selectedTasks", { count: blockedBy.length })}
                        </span>
                        <ChevronDown
                          size={14}
                          className="text-muted-foreground"
                        />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="max-h-48 w-[var(--radix-popover-trigger-width)] overflow-y-auto p-1"
                      align="start"
                    >
                      {classTasks.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => togglePrereq(t.id)}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-subtle"
                        >
                          <div
                            className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border"
                            style={
                              blockedBy.includes(t.id)
                                ? {
                                    backgroundColor: themeColor,
                                    borderColor: themeColor,
                                  }
                                : undefined
                            }
                          >
                            {blockedBy.includes(t.id) && (
                              <Check
                                size={10}
                                strokeWidth={3}
                                className="text-white"
                              />
                            )}
                          </div>
                          <span className="truncate">{t.title}</span>
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                  {blockedBy.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {blockedBy.map((id) => {
                        const t = classTasks.find((ct) => ct.id === id);
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs text-foreground"
                          >
                            <span className="max-w-[100px] truncate">
                              {t?.title ?? id}
                            </span>
                            <button
                              type="button"
                              onClick={() => togglePrereq(id)}
                              className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                            >
                              <X size={10} strokeWidth={2} />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <div className="flex items-center gap-2">
            {/* Clear button — visible when there's any content to clear */}
            {(draftId || rawText.trim() || title.trim()) && (
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 size={12} strokeWidth={2} />
                {t("clear")}
              </button>
            )}
            <span className="text-xs text-muted-foreground">
              {!expanded && rawText.trim()
                ? t("footerHint.useAiOrExpand")
                : !dueAtValid && expanded
                  ? t("dueDateRequired")
                  : formValid
                    ? t("footerHint.ready")
                    : t("footerHint.fillRequired")}
            </span>
          </div>
          <Button
            onClick={handleEditBody}
            disabled={submitting || uploading}
            className="text-white hover:opacity-90"
            style={{ backgroundColor: formValid ? themeColor : undefined }}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("editBody")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
