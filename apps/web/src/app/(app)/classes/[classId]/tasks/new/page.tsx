"use client";

import { Loader2, Sparkles, Upload, X } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { useAuth } from "@/components/auth-provider";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { TaskSummary } from "@/lib/api";
import {
  ApiError,
  createTask,
  listClassTasks,
  parseTask,
  uploadTaskAttachment,
} from "@/lib/api";

function toLocalDatetimeValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function fromLocalDatetimeValue(val: string): string | null {
  if (!val) return null;
  return new Date(val).toISOString();
}

export default function CreateTaskPage() {
  const { token } = useAuth();
  const params = useParams<{ classId: string }>();
  const router = useRouter();
  const classId = params.classId;

  // AI parse
  const [rawText, setRawText] = useState("");
  const [parsing, setParsing] = useState(false);

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [allowLateSubmission, setAllowLateSubmission] = useState(true);
  const [blockedBy, setBlockedBy] = useState<string[]>([]);
  const [highlight, setHighlight] = useState<Set<string>>(new Set());

  // Attachments
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Existing tasks for dependency selection
  const [classTasks, setClassTasks] = useState<TaskSummary[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load class tasks for dependency picker
  const loadClassTasks = useCallback(async () => {
    if (!token) return;
    try {
      const tasks = await listClassTasks(token, classId);
      setClassTasks(tasks);
    } catch {
      // non-critical
    }
  }, [token, classId]);

  useEffect(() => {
    void loadClassTasks();
  }, [loadClassTasks]);

  // AI parse handler
  async function handleParse() {
    if (!token || !rawText.trim()) return;
    setParsing(true);
    try {
      const result = await parseTask(token, rawText.trim());
      const filled = new Set<string>();

      if (result.title) {
        setTitle(result.title);
        filled.add("title");
      }
      if (result.startAt) {
        setStartAt(toLocalDatetimeValue(result.startAt));
        filled.add("startAt");
      }
      if (result.dueAt) {
        setDueAt(toLocalDatetimeValue(result.dueAt));
        filled.add("dueAt");
      }
      if (result.description) {
        setDescription(result.description);
        filled.add("description");
      }

      setHighlight(filled);
      setTimeout(() => setHighlight(new Set()), 1500);
      toast.success("Parsed successfully. Please verify the fields.");
    } catch {
      toast.error("Parse failed. Please fill in manually.");
    } finally {
      setParsing(false);
    }
  }

  // File upload handler
  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0 || !token) return;
    setUploading(true);
    try {
      // We need a task to attach files to, but the task isn't created yet.
      // We'll store files locally and upload after task creation.
      // For now, just track the File objects.
      toast.info("Attachments will be uploaded after the task is published.");
      // Store as pending files
      const pending = Array.from(files);
      setPendingFiles((prev) => [...prev, ...pending]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // Validation
  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "Title is required";
    if (!dueAt) errs.dueAt = "Due date is required";
    if (dueAt) {
      const dueDate = new Date(dueAt);
      if (dueDate.getTime() < Date.now()) {
        errs.dueAt = "Due date must be in the future";
      }
      if (startAt) {
        const startDate = new Date(startAt);
        if (startDate.getTime() > dueDate.getTime()) {
          errs.startAt = "Start date must be before due date";
        }
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !validate()) return;

    setSubmitting(true);
    try {
      const task = await createTask(token, classId, {
        title: title.trim(),
        description: description.trim() || null,
        startAt: fromLocalDatetimeValue(startAt),
        dueAt: fromLocalDatetimeValue(dueAt),
        allowLateSubmission,
        blockedBy: blockedBy.length > 0 ? blockedBy : undefined,
      });

      // Upload pending files
      for (const file of pendingFiles) {
        try {
          await uploadTaskAttachment(token, task.id, file);
        } catch {
          toast.error(`Failed to upload ${file.name}`);
        }
      }

      toast.success("Task published");
      router.push(`/classes/${classId}/tasks/${task.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("Failed to create task");
      }
      setSubmitting(false);
    }
  }

  function highlightClass(field: string): string {
    return highlight.has(field)
      ? "ring-2 ring-status-warning/50 transition-all duration-1000"
      : "transition-all duration-1000";
  }

  function toggleBlockedBy(taskId: string) {
    setBlockedBy((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId],
    );
  }

  return (
    <>
      <AppHeader title="Publish Task" />
      <div className="mx-auto max-w-180 p-6 space-y-6">
        <PageHeader
          title="Publish a task"
          description="Create a new task for your class"
        />

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* AI Parse section */}
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <Label htmlFor="ai-input" className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              AI Parse
            </Label>
            <Textarea
              id="ai-input"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste task description here, AI will extract key info...&#10;&#10;e.g. Submit algorithm homework by Friday, implement quicksort with O(n log n) complexity"
              rows={4}
              disabled={parsing || submitting}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleParse}
              disabled={parsing || !rawText.trim() || submitting}
            >
              {parsing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Parsing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  AI Parse
                </>
              )}
            </Button>
          </div>

          {/* Structured form */}
          <div className="space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="task-title">
                Title <span className="text-status-error">*</span>
              </Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setErrors((prev) => ({ ...prev, title: "" }));
                }}
                placeholder="Task name"
                className={highlightClass("title")}
                disabled={submitting}
              />
              {errors.title && (
                <p className="text-sm text-status-error">{errors.title}</p>
              )}
            </div>

            {/* Start & Due date */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="task-start">Start time</Label>
                <Input
                  id="task-start"
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => {
                    setStartAt(e.target.value);
                    setErrors((prev) => ({ ...prev, startAt: "" }));
                  }}
                  className={highlightClass("startAt")}
                  disabled={submitting}
                />
                {errors.startAt && (
                  <p className="text-sm text-status-error">{errors.startAt}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-due">
                  Due date <span className="text-status-error">*</span>
                </Label>
                <Input
                  id="task-due"
                  type="datetime-local"
                  value={dueAt}
                  onChange={(e) => {
                    setDueAt(e.target.value);
                    setErrors((prev) => ({ ...prev, dueAt: "" }));
                  }}
                  className={highlightClass("dueAt")}
                  disabled={submitting}
                />
                {errors.dueAt && (
                  <p className="text-sm text-status-error">{errors.dueAt}</p>
                )}
              </div>
            </div>

            {/* Allow late submission */}
            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div>
                <Label htmlFor="late-switch">Allow late submission</Label>
                <p className="text-xs text-muted-foreground">
                  Students can submit after the due date
                </p>
              </div>
              <Switch
                id="late-switch"
                checked={allowLateSubmission}
                onCheckedChange={setAllowLateSubmission}
                disabled={submitting}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="task-desc">Description</Label>
              <Textarea
                id="task-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Task description (supports Markdown)"
                rows={8}
                className={`font-mono text-sm ${highlightClass("description")}`}
                disabled={submitting}
              />
            </div>

            {/* Predecessor tasks */}
            {classTasks.length > 0 && (
              <div className="space-y-2">
                <Label>Predecessor tasks</Label>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2">
                  {classTasks.map((t) => (
                    <label
                      key={t.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent/50"
                    >
                      <input
                        type="checkbox"
                        checked={blockedBy.includes(t.id)}
                        onChange={() => toggleBlockedBy(t.id)}
                        className="rounded"
                        disabled={submitting}
                      />
                      <span className="truncate">{t.title}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Selected tasks must be completed before this one.
                </p>
              </div>
            )}

            {/* Attachments */}
            <div className="space-y-2">
              <Label>Attachments</Label>
              <div className="space-y-1">
                {pendingFiles.map((file, idx) => (
                  <div
                    key={`${file.name}-${file.size}`}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingFiles((prev) =>
                          prev.filter((_, i) => i !== idx),
                        )
                      }
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || submitting}
              >
                <Upload className="mr-2 h-4 w-4" />
                Add files
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Publish task
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
