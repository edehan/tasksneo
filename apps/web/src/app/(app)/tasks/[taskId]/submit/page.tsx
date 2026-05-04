"use client";

import { Loader2 } from "lucide-react";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { EditorPage } from "@/features/editor/components/editor-page";
import { isSubmissionLocked } from "@/features/tasks/lib/task-detail-status";
import {
  ApiError,
  type AttachmentMeta,
  type ClassSummary,
  getClass,
  getMySubmission,
  getTask,
  type TaskDetail,
} from "@/lib/api";

export default function SubmitTaskPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const t = useTranslations("taskEditorPage");

  const taskId = params?.taskId as string;

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [cls, setCls] = useState<ClassSummary | null>(null);
  const [existingContent, setExistingContent] = useState<string | undefined>(
    undefined,
  );
  const [existingAttachments, setExistingAttachments] = useState<
    AttachmentMeta[]
  >([]);
  const [hasExistingSubmission, setHasExistingSubmission] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user || !taskId) return;

    setLoading(true);
    setError(null);

    try {
      const [taskData, submission] = await Promise.all([
        getTask(taskId),
        getMySubmission(taskId).catch(() => null),
      ]);
      const classData = await getClass(taskData.classId);

      setTask(taskData);
      setCls(classData);

      if (submission) {
        setHasExistingSubmission(true);
        setExistingContent(submission.content ?? "");
        setExistingAttachments(submission.attachments);
      } else {
        setHasExistingSubmission(false);
        setExistingContent("");
        setExistingAttachments([]);
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("failedLoadTask");
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user, taskId, t]);

  useEffect(() => {
    if (!authLoading && user) {
      void loadData();
    } else if (!authLoading && !user) {
      const search = searchParams.toString();
      const next = search ? `${pathname}?${search}` : pathname;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [authLoading, user, loadData, router, pathname, searchParams]);

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background">
        <p className="text-sm text-destructive">{error}</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          {t("goBack")}
        </button>
      </div>
    );
  }

  if (!task || !cls) return null;

  const locked = isSubmissionLocked(task);

  if (locked && !hasExistingSubmission) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background px-4 text-center">
        <p className="text-sm font-semibold text-destructive">
          {t("submissionClosedTitle")}
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t("submissionClosedDescription")}
        </p>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          {t("goBack")}
        </button>
      </div>
    );
  }

  return (
    <EditorPage
      mode="submit"
      classId={task.classId}
      taskId={taskId}
      className={cls.name}
      taskTitle={task.title}
      accentColor={cls.color}
      initialContent={existingContent}
      initialAttachments={existingAttachments}
      readOnly={locked}
      lockedReason={locked ? t("readOnlySubmission") : undefined}
    />
  );
}
