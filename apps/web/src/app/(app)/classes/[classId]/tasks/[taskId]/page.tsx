"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Edit,
  FileText,
  Paperclip,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { useAuth } from "@/components/auth-provider";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { ClassSummary, TaskDetail } from "@/lib/api";
import {
  ApiError,
  deleteTask,
  getClass,
  getFileUrl,
  getTask,
  markTaskViewed,
} from "@/lib/api";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DueStatus({ dueAt }: { dueAt: string | null }) {
  if (!dueAt) return null;
  const date = new Date(dueAt);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) {
    return (
      <Badge
        variant="outline"
        className="bg-status-error/10 text-status-error border-transparent"
      >
        Overdue
      </Badge>
    );
  }
  if (days === 0) {
    return (
      <Badge
        variant="outline"
        className="bg-status-warning/10 text-status-warning border-transparent"
      >
        Due today
      </Badge>
    );
  }
  return null;
}

function DeleteTaskDialog({
  taskId,
  token,
  hasSubmissions,
  onDeleted,
}: {
  taskId: string;
  token: string;
  hasSubmissions: boolean;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      await deleteTask(token, taskId);
      toast.success("Task deleted");
      onDeleted();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete task",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete task</DialogTitle>
          <DialogDescription>
            {hasSubmissions
              ? "This task has submissions. Deleting will clear the task content but preserve all student submissions."
              : "This will permanently delete the task. This action cannot be undone."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TaskDetailPage() {
  const { token } = useAuth();
  const params = useParams<{ classId: string; taskId: string }>();
  const router = useRouter();
  const { classId, taskId } = params;

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [cls, setCls] = useState<ClassSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [taskData, classData] = await Promise.all([
        getTask(token, taskId),
        getClass(token, classId),
      ]);
      setTask(taskData);
      setCls(classData);
    } catch {
      // handled by empty state
    } finally {
      setLoading(false);
    }
  }, [token, classId, taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Fire-and-forget read tracking
  useEffect(() => {
    if (!token || !taskId) return;
    void markTaskViewed(token, taskId).catch(() => {
      /* silent */
    });
  }, [token, taskId]);

  // Set class accent color
  useEffect(() => {
    if (cls?.color) {
      document.documentElement.style.setProperty("--class-accent", cls.color);
      return () => {
        document.documentElement.style.removeProperty("--class-accent");
      };
    }
  }, [cls?.color]);

  const isAdmin = cls?.myRole === "OWNER" || cls?.myRole === "ADMIN";
  const isMember = cls?.myRole === "MEMBER";
  const hasSubmissions = (task?.stats?.submittedCount ?? 0) > 0;

  return (
    <>
      <AppHeader title={task?.title ?? "Task"} />
      <div className="mx-auto max-w-180 p-6 space-y-6">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : task ? (
          <>
            {/* Header */}
            <div>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl font-semibold tracking-tight">
                    {task.title}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>Due {formatDateTime(task.dueAt)}</span>
                    <DueStatus dueAt={task.dueAt} />
                    {task.startAt && (
                      <>
                        <span>·</span>
                        <span>Starts {formatDateTime(task.startAt)}</span>
                      </>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/classes/${classId}/tasks/${taskId}/edit`}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </Link>
                    </Button>
                    <DeleteTaskDialog
                      taskId={taskId}
                      token={token ?? ""}
                      hasSubmissions={hasSubmissions}
                      onDeleted={() => router.push(`/classes/${classId}`)}
                    />
                  </div>
                )}
              </div>

              {/* Admin stats bar */}
              {task.stats && (
                <div className="mt-3 flex items-center gap-4 rounded-lg border bg-muted/50 px-4 py-2 text-sm">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    {task.stats.memberCount} members
                  </span>
                  <span>·</span>
                  <span>{task.stats.viewedCount} read</span>
                  <span>·</span>
                  <span>{task.stats.submittedCount} submitted</span>
                  <Button asChild variant="ghost" size="sm" className="ml-auto">
                    <Link
                      href={`/classes/${classId}/tasks/${taskId}/submissions`}
                    >
                      View all submissions
                    </Link>
                  </Button>
                </div>
              )}
            </div>

            <Separator />

            {/* Dependency banner */}
            {task.blockedBy.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-status-warning/30 bg-status-warning/5 p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" />
                <div>
                  <p className="font-medium">
                    Depends on {task.blockedBy.length} other task
                    {task.blockedBy.length > 1 ? "s" : ""}
                  </p>
                  <p className="text-muted-foreground">
                    This task has prerequisites. Check with your teacher for
                    details.
                  </p>
                </div>
              </div>
            )}

            {/* Body */}
            {task.description ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {task.description}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No description provided.
              </p>
            )}

            {/* Attachments */}
            {task.attachments.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium flex items-center gap-1.5">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  Attachments
                </h3>
                <div className="space-y-1">
                  {task.attachments.map((att) => (
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
                      <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Submission action for members */}
            {isMember && (
              <div className="pt-2">
                <Button asChild>
                  <Link href={`/classes/${classId}/tasks/${taskId}/submit`}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Submit
                  </Link>
                </Button>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            title="Task not found"
            description="This task may have been deleted or you don't have access."
          />
        )}
      </div>
    </>
  );
}
