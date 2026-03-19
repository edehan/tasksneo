"use client";

import { Loader2, Upload, X } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { useAuth } from "@/components/auth-provider";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { TaskDetail, TaskSummary } from "@/lib/api";
import {
  ApiError,
  getTask,
  listClassTasks,
  updateTask,
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

export default function EditTaskPage() {
  const { token } = useAuth();
  const params = useParams<{ classId: string; taskId: string }>();
  const router = useRouter();
  const { classId, taskId } = params;

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [allowLateSubmission, setAllowLateSubmission] = useState(true);
  const [blockedBy, setBlockedBy] = useState<string[]>([]);

  // Attachments
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Existing tasks for dependency selection
  const [classTasks, setClassTasks] = useState<TaskSummary[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [taskData, tasks] = await Promise.all([
        getTask(token, taskId),
        listClassTasks(token, classId),
      ]);
      setTask(taskData);
      setTitle(taskData.title);
      setDescription(taskData.description ?? "");
      setStartAt(toLocalDatetimeValue(taskData.startAt));
      setDueAt(toLocalDatetimeValue(taskData.dueAt));
      setAllowLateSubmission(taskData.allowLateSubmission);
      setBlockedBy(taskData.blockedBy);
      // Exclude the current task from dependency list
      setClassTasks(tasks.filter((t) => t.id !== taskId));
    } catch {
      toast.error("Failed to load task");
    } finally {
      setLoading(false);
    }
  }, [token, classId, taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "Title is required";
    if (dueAt && startAt) {
      const dueDate = new Date(dueAt);
      const startDate = new Date(startAt);
      if (startDate.getTime() > dueDate.getTime()) {
        errs.startAt = "Start date must be before due date";
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
      await updateTask(token, taskId, {
        title: title.trim(),
        description: description.trim() || null,
        startAt: fromLocalDatetimeValue(startAt),
        dueAt: fromLocalDatetimeValue(dueAt),
        allowLateSubmission,
        blockedBy,
      });

      // Upload pending files
      for (const file of pendingFiles) {
        try {
          await uploadTaskAttachment(token, taskId, file);
        } catch {
          toast.error(`Failed to upload ${file.name}`);
        }
      }

      toast.success("Task updated");
      router.push(`/classes/${classId}/tasks/${taskId}`);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("Failed to update task");
      }
      setSubmitting(false);
    }
  }

  function toggleBlockedBy(id: string) {
    setBlockedBy((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <>
      <AppHeader title="Edit Task" />
      <div className="mx-auto max-w-180 p-6 space-y-6">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : !task ? (
          <p className="text-muted-foreground">Task not found.</p>
        ) : (
          <>
            <PageHeader title="Edit task" description={task.title} />

            {/* Admin stats bar */}
            {task.stats && (
              <div className="flex items-center gap-4 rounded-lg border bg-muted/50 px-4 py-2 text-sm">
                <span>{task.stats.memberCount} members</span>
                <span>·</span>
                <span>{task.stats.viewedCount} read</span>
                <span>·</span>
                <span>{task.stats.submittedCount} submitted</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
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
                    disabled={submitting}
                  />
                  {errors.startAt && (
                    <p className="text-sm text-status-error">
                      {errors.startAt}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-due">Due date</Label>
                  <Input
                    id="task-due"
                    type="datetime-local"
                    value={dueAt}
                    onChange={(e) => {
                      setDueAt(e.target.value);
                      setErrors((prev) => ({ ...prev, dueAt: "" }));
                    }}
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
                  rows={10}
                  className="font-mono text-sm"
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
                </div>
              )}

              {/* Existing attachments */}
              {task.attachments.length > 0 && (
                <div className="space-y-2">
                  <Label>Existing attachments</Label>
                  <div className="space-y-1">
                    {task.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {att.originalName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {att.sizeBytes
                            ? `${(att.sizeBytes / 1024).toFixed(1)} KB`
                            : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New attachments */}
              <div className="space-y-2">
                <Label>Add attachments</Label>
                <div className="space-y-1">
                  {pendingFiles.map((file, idx) => (
                    <div
                      key={`${file.name}-${file.size}`}
                      className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {file.name}
                      </span>
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
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files) {
                      setPendingFiles((prev) => [
                        ...prev,
                        ...Array.from(files),
                      ]);
                      e.target.value = "";
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={submitting}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Add files
                </Button>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.back()}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save changes
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </>
  );
}
