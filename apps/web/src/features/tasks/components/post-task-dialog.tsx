"use client";

import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Paperclip,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
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
  ApiError,
  createTaskDraft,
  parseTask,
  type ParseTaskResponse,
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

function toLocalDatetimeString(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    // Format as YYYY-MM-DDTHH:mm for datetime-local input
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
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
  const [startAt, setStartAt] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [allowLate, setAllowLate] = useState(false);
  const [attachmentNames, setAttachmentNames] = useState<string[]>([]);

  // UI state
  const [expanded, setExpanded] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Validation ──────────────────────────────────────────────────────────

  const titleValid = title.trim().length > 0;
  const datesValid =
    !startAt || !dueAt || new Date(dueAt) > new Date(startAt);
  const formValid = titleValid && datesValid;

  // ─── Reset ───────────────────────────────────────────────────────────────

  const resetForm = useCallback(() => {
    setRawText("");
    setTitle("");
    setStartAt("");
    setDueAt("");
    setAllowLate(false);
    setAttachmentNames([]);
    setExpanded(false);
    setParsing(false);
    setParsed(false);
    setSubmitting(false);
    setTitleTouched(false);
  }, []);

  // ─── AI Parse ────────────────────────────────────────────────────────────

  async function handleAiParse() {
    if (!token || !rawText.trim() || parsing || parsed) return;

    setParsing(true);
    try {
      const result: ParseTaskResponse = await parseTask(token, rawText.trim());

      if (result.title) setTitle(result.title);
      if (result.startAt) setStartAt(toLocalDatetimeString(result.startAt));
      if (result.dueAt) setDueAt(toLocalDatetimeString(result.dueAt));

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

  // ─── Attach (mock) ───────────────────────────────────────────────────────

  function handleAttachClick() {
    fileInputRef.current?.click();
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const names = Array.from(files).map((f) => f.name);
    setAttachmentNames((prev) => [...prev, ...names]);
    // Reset so the same file can be re-selected
    e.target.value = "";
  }

  function removeAttachment(index: number) {
    setAttachmentNames((prev) => prev.filter((_, i) => i !== index));
  }

  // ─── Submit (Create Draft → Edit Body) ────────────────────────────────

  async function handleEditBody() {
    if (!token || !formValid) return;

    setSubmitting(true);
    try {
      const draft = await createTaskDraft(token, classId, {
        title: title.trim(),
        sourceText: rawText.trim() || null,
        startAt: startAt ? new Date(startAt).toISOString() : null,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        allowLateSubmission: allowLate,
      });

      resetForm();
      onOpenChange(false);
      onEditBody({ taskId: draft.id, title: draft.title });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to create task draft";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
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
      <DialogContent className="max-w-xl gap-0 p-0">
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

        <div className="px-6 py-5">
          {/* Textarea area */}
          <div className="rounded-lg border border-border bg-background">
            <textarea
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                if (parsed) setParsed(false);
              }}
              placeholder="Describe your task here..."
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
                onClick={handleAttachClick}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-foreground"
              >
                <Paperclip size={13} strokeWidth={2} />
                Attach
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
                Expand Form
              </button>

              {/* AI Parse */}
              {rawText.trim().length > 0 && (
                <button
                  type="button"
                  onClick={handleAiParse}
                  disabled={parsing || parsed}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                    parsed
                      ? "border border-border bg-muted text-muted-foreground"
                      : "text-white"
                  }`}
                  style={
                    !parsed
                      ? {
                          background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)`,
                        }
                      : undefined
                  }
                >
                  {parsing ? (
                    <Loader2 size={13} strokeWidth={2} className="animate-spin" />
                  ) : (
                    <Sparkles size={13} strokeWidth={2} />
                  )}
                  {parsed ? "Parsed" : "AI Parse"}
                </button>
              )}
            </div>
          </div>

          {/* Attachment chips */}
          {attachmentNames.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {attachmentNames.map((name, i) => (
                <span
                  key={`${name}-${i}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground"
                >
                  <Paperclip size={11} strokeWidth={2} className="text-muted-foreground" />
                  {name}
                  <button
                    type="button"
                    onClick={() => removeAttachment(i)}
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
            style={{ maxHeight: expanded ? 400 : 0, opacity: expanded ? 1 : 0 }}
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
                  <Label htmlFor="post-task-start" className="text-sm">
                    Start Date
                  </Label>
                  <Input
                    id="post-task-start"
                    type="datetime-local"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="post-task-due" className="text-sm">
                    Due Date
                  </Label>
                  <Input
                    id="post-task-due"
                    type="datetime-local"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    className={
                      startAt && dueAt && !datesValid
                        ? "border-destructive focus-visible:ring-destructive"
                        : ""
                    }
                  />
                  {startAt && dueAt && !datesValid && (
                    <p className="text-xs text-destructive">
                      Due date must be after start date
                    </p>
                  )}
                </div>
              </div>

              {/* Allow late */}
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={allowLate}
                  onChange={(e) => setAllowLate(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-current"
                  style={{ accentColor: themeColor }}
                />
                <span className="text-sm text-foreground">
                  Allow late submission
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <span className="text-xs text-muted-foreground">
            {formValid
              ? "Ready to continue"
              : "Fill required fields to continue"}
          </span>
          <Button
            onClick={handleEditBody}
            disabled={!formValid || submitting}
            className="text-white hover:opacity-90"
            style={{ backgroundColor: themeColor }}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Edit Body &rarr;
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
