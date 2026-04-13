"use client";

import { Loader2 } from "lucide-react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { EditorPage } from "@/features/editor/components/editor-page";
import {
  ApiError,
  type ClassSummary,
  getClass,
  getTask,
  getTaskDraftMarkdown,
  type TaskDetail,
} from "@/lib/api";

export default function EditTaskPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const t = useTranslations("taskEditorPage");

  const taskId = params?.taskId as string;

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [cls, setCls] = useState<ClassSummary | null>(null);
  const [markdown, setMarkdown] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user || !taskId) return;

    setLoading(true);
    setError(null);

    try {
      const [taskData, mdData] = await Promise.all([
        getTask(taskId),
        getTaskDraftMarkdown(taskId).catch(() => ({
          markdown: null as string | null,
        })),
      ]);
      const classData = await getClass(taskData.classId);

      setTask(taskData);
      setCls(classData);
      setMarkdown(mdData.markdown ?? taskData.description ?? "");
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
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [authLoading, user, loadData, router, pathname]);

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

  return (
    <EditorPage
      mode="publish"
      classId={task.classId}
      taskId={taskId}
      className={cls.name}
      taskTitle={task.title}
      accentColor={cls.color}
      initialContent={markdown}
      initialAttachments={task.attachments}
      isAlreadyPublished={task.isPublished}
      initialDueAt={task.dueAt ?? undefined}
    />
  );
}
