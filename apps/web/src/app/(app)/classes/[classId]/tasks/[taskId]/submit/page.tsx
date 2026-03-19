"use client";

import { FileText, Loader2, Upload, X } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { useAuth } from "@/components/auth-provider";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { SubmissionDetail, TaskDetail } from "@/lib/api";
import {
  ApiError,
  getFileUrl,
  getMySubmission,
  getTask,
  uploadSubmissionAttachment,
  upsertMySubmission,
} from "@/lib/api";

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SubmitPage() {
  const { token } = useAuth();
  const params = useParams<{ classId: string; taskId: string }>();
  const router = useRouter();
  const { classId, taskId } = params;

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [content, setContent] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isUpdate = submission !== null;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [taskData, subData] = await Promise.all([
        getTask(token, taskId),
        getMySubmission(token, taskId),
      ]);
      setTask(taskData);
      if (subData) {
        setSubmission(subData);
        setContent(subData.content ?? "");
      }
    } catch {
      toast.error("Failed to load task");
    } finally {
      setLoading(false);
    }
  }, [token, taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Check if deadline passed and late submission not allowed
  const deadlinePassed =
    task?.dueAt && new Date(task.dueAt).getTime() < Date.now();
  const cannotModify = deadlinePassed && !task?.allowLateSubmission && isUpdate;

  async function handleSubmit() {
    if (!token) return;

    setSubmitting(true);
    try {
      // Save content
      const result = await upsertMySubmission(token, taskId, content || null);

      // Upload new files
      for (const file of pendingFiles) {
        try {
          await uploadSubmissionAttachment(token, taskId, file);
        } catch {
          toast.error(`Failed to upload ${file.name}`);
        }
      }

      setSubmission(result);
      setPendingFiles([]);
      toast.success(isUpdate ? "Submission updated" : "Submitted successfully");
      router.push(`/classes/${classId}/tasks/${taskId}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <AppHeader title={`Submit: ${task?.title ?? "Task"}`} />
      <div className="mx-auto max-w-180 p-6 space-y-6">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : !task ? (
          <p className="text-muted-foreground">Task not found.</p>
        ) : cannotModify ? (
          <>
            <PageHeader
              title={`Submit: ${task.title}`}
              description="Deadline has passed"
            />
            <div className="rounded-lg border border-status-error/30 bg-status-error/5 p-4 text-sm text-status-error">
              The deadline has passed and late submissions are not allowed. Your
              existing submission cannot be modified.
            </div>
          </>
        ) : (
          <>
            <PageHeader
              title={`Submit: ${task.title}`}
              description={
                isUpdate
                  ? "Update your submission"
                  : "Write your submission below"
              }
            />

            {/* Content editor */}
            <div className="space-y-2">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your submission here... (supports Markdown)"
                rows={12}
                className="font-mono text-sm"
                disabled={submitting}
              />
              <p className="text-xs text-muted-foreground">
                Supports Markdown formatting.
              </p>
            </div>

            {/* Existing attachments */}
            {submission && submission.attachments.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Existing attachments</h3>
                <div className="space-y-1">
                  {submission.attachments.map((att) => (
                    <a
                      key={att.id}
                      href={getFileUrl(att.fileKey)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent/50"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">
                        {att.originalName}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatFileSize(att.sizeBytes)}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* New files */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">
                {isUpdate ? "Add more files" : "Attachments"}
              </h3>
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
                onChange={(e) => {
                  const files = e.target.files;
                  if (files) {
                    setPendingFiles((prev) => [...prev, ...Array.from(files)]);
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
                variant="ghost"
                onClick={() => router.back()}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isUpdate ? "Update submission" : "Submit"}
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
