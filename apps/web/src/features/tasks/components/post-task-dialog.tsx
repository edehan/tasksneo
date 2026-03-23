"use client";

import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Paperclip,
  Sparkles,
  X,
} from "lucide-react";
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
  ApiError,
  createTaskDraft,
  listClassTasks,
  parseTaskDraft,
  updateTask,
  uploadTaskAttachment,
  type AttachmentMeta,
  type TaskSummary,
} from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PostTaskDialogProps {
  classId: string;
  className: string;
  themeColor: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditBody: (data: { taskId: string; title: string }) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const { token } = useAuth();

  // Form state
  const [rawText, setRawText] = useState("");
  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState<Date | undefined>(undefined);
  const [dueAt, setDueAt] = useState<Date | undefined>(undefined);
  const [allowLate, setAllowLate] = useState(false);
  const [blockedBy, setBlockedBy] = useState<string[]>([]);

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

  // Prerequisites
  const [classTasks, setClassTasks] = useState<TaskSummary[]>([]);
  const [prereqOpen, setPrereqOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep ref in sync
  useEffect(() => {
    draftIdRef.current = draftId;
  }, [draftId]);

  // ─── Load class tasks for prerequisites ─────────────────────────────────

  useEffect(() => {
    if (!open || !token) return;
    listClassTasks(token, classId)
      .then((tasks) => setClassTasks(tasks.filter((t) => t.id !== draftId)))
      .catch(() => {});
  }, [open, token, classId, draftId]);

  // ─── Validation ──────────────────────────────────────────────────────────

  const titleValid = title.trim().length > 0;
  const datesValid = !startAt || !dueAt || dueAt > startAt;
  const formValid = titleValid && datesValid;

  // ─── Lazy draft creation ─────────────────────────────────────────────────

  const ensureDraft = useCallback(async (): Promise<string> => {
    if (draftIdRef.current) return draftIdRef.current;
    if (!token) throw new Error("Not authenticated");

    const draft = await createTaskDraft(token, classId, {
      title: title.trim() || "Untitled Task",
      sourceText: rawText.trim() || null,
      startAt: startAt ? startAt.toISOString() : null,
      dueAt: dueAt ? dueAt.toISOString() : null,
      allowLateSubmission: allowLate,
      blockedBy,
    });
    setDraftId(draft.id);
    draftIdRef.current = draft.id;
    return draft.id;
  }, [token, classId, title, rawText, startAt, dueAt, allowLate, blockedBy]);

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
    setClassTasks([]);
  }, []);

  // ─── AI Parse ──────────────────────────────────────────────────────────

  async function handleAiParse() {
    if (!token || !rawText.trim() || parsing || parsed) return;

    setParsing(true);
    try {
      const taskId = await ensureDraft();
      const result = await parseTaskDraft(token, taskId, rawText.trim());

      if (result.title) setTitle(result.title);
      if (result.startAt) {
        try {
          setStartAt(new Date(result.startAt));
        } catch {}
      }
      if (result.dueAt) {
        try {
          setDueAt(new Date(result.dueAt));
        } catch {}
      }

      setParsed(true);
      setExpanded(true);
      toast.success("AI parsed your task description");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to parse task";
      toast.error(message);
    } finally {
      setParsing(false);
    }
  }

  // ─── File upload ───────────────────────────────────────────────────────

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || !token) return;
    e.target.value = "";

    setUploading(true);
    try {
      const taskId = await ensureDraft();
      const fileArray = Array.from(files);

      const results = await Promise.all(
        fileArray.map((f) => uploadTaskAttachment(token, taskId, f)),
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

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  // ─── Submit (Create/Update Draft → Edit Body) ──────────────────────────

  async function handleEditBody() {
    if (!token || !formValid) return;

    setSubmitting(true);
    try {
      let taskId: string;

      const taskData = {
        title: title.trim(),
        sourceText: rawText.trim() || null,
        startAt: startAt ? startAt.toISOString() : null,
        dueAt: dueAt ? dueAt.toISOString() : null,
        allowLateSubmission: allowLate,
        blockedBy,
      };

      if (draftIdRef.current) {
        // Draft already exists — update it with latest form state
        await updateTask(token, draftIdRef.current, taskData);
        taskId = draftIdRef.current;
      } else {
        // Create new draft
        const draft = await createTaskDraft(token, classId, taskData);
        taskId = draft.id;
      }

      resetForm();
      onOpenChange(false);
      onEditBody({ taskId, title: title.trim() });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to create task draft";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
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
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetForm();
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
            Post Task &mdash; {clsName}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {/* Textarea area */}
          <div className="rounded-lg border border-border bg-background">
            <textarea
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                if (parsed) setParsed(false);
              }}
              placeholder={
                'Describe your task here...\ne.g. "Complete Chapter 5 exercises, due in 2 weeks, allow late submissions"'
              }
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
                {uploading ? "Uploading..." : "Attach"}
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
                {expanded ? "Collapse" : "Expand Form"}
              </button>

              {/* AI Parse */}
              {rawText.trim().length > 0 && (
                <button
                  type="button"
                  onClick={handleAiParse}
                  disabled={parsing || parsed}
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
                  {parsing ? "Parsing..." : parsed ? "Parsed" : "AI Parse"}
                </button>
              )}
            </div>
          </div>

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

          {/* Expandable form */}
          <div
            className="overflow-hidden transition-all duration-300 ease-in-out"
            style={{
              maxHeight: expanded ? 600 : 0,
              opacity: expanded ? 1 : 0,
            }}
          >
            <div className="pt-5">
              <span className="text-label-upper mb-3 block">Task Details</span>

              {/* Title */}
              <div className="mb-4 space-y-1.5">
                <Label htmlFor="post-task-title" className="text-sm">
                  Task Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="post-task-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => setTitleTouched(true)}
                  placeholder="e.g. Chapter 5 Homework"
                  className={
                    titleTouched && !titleValid
                      ? "border-destructive focus-visible:ring-destructive"
                      : ""
                  }
                />
                {titleTouched && !titleValid && (
                  <p className="text-xs text-destructive">Title is required</p>
                )}
              </div>

              {/* Dates */}
              <div className="mb-4 flex gap-3">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-sm">Start Date</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <DateTimePicker
                        value={startAt}
                        onChange={setStartAt}
                        placeholder="Optional"
                        disabled={submitting}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setStartAt(new Date())}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-foreground"
                    >
                      <Clock size={11} strokeWidth={2} />
                      Now
                    </button>
                  </div>
                  <p className="text-xs text-text-muted-soft">
                    Defaults to now if not set
                  </p>
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label className="text-sm">Due Date</Label>
                  <DateTimePicker
                    value={dueAt}
                    onChange={setDueAt}
                    placeholder="Select due date"
                    disabled={submitting}
                  />
                  {startAt && dueAt && !datesValid && (
                    <p className="text-xs text-destructive">
                      Due date must be after start date
                    </p>
                  )}
                </div>
              </div>

              {/* Allow late */}
              <label className="mb-4 flex cursor-pointer items-center gap-2">
                <div
                  className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-all duration-150"
                  style={{
                    borderColor: allowLate ? themeColor : undefined,
                    backgroundColor: allowLate ? themeColor : "transparent",
                  }}
                >
                  {allowLate && (
                    <Check size={11} strokeWidth={3} className="text-white" />
                  )}
                </div>
                <span className="text-sm text-foreground">
                  Allow late submission
                </span>
              </label>

              {/* Prerequisites */}
              {classTasks.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-sm">Prerequisites</Label>
                  <Popover open={prereqOpen} onOpenChange={setPrereqOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <span className="text-muted-foreground">
                          {blockedBy.length === 0
                            ? "Select prerequisite tasks..."
                            : `${blockedBy.length} task${blockedBy.length > 1 ? "s" : ""} selected`}
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
          <span className="text-xs text-muted-foreground">
            {!expanded && rawText.trim()
              ? "Use AI Parse or expand form to fill details"
              : formValid
                ? "Ready to continue"
                : "Fill required fields to continue"}
          </span>
          <Button
            onClick={handleEditBody}
            disabled={!formValid || submitting || uploading}
            className="text-white hover:opacity-90"
            style={{ backgroundColor: formValid ? themeColor : undefined }}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Edit Body &rarr;
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
