"use client";

import { ArrowLeft, ArrowRight, Calendar, Loader2 } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { MarkdownPreview } from "@/features/editor/components/markdown-preview";
import { TaskSidebar } from "@/features/tasks/components/task-sidebar";
import {
  type DetailStatus,
  deriveDetailStatus,
  getFooterText,
  getStatusBadge } from "@/features/tasks/lib/task-detail-status";
import type { ClassSummary, TaskDetail } from "@/lib/api";
import { deleteTask, getClass, getTask, markTaskViewed } from "@/lib/api";

type SidebarSection = "attachments" | "discussion" | undefined;

function toSidebarSection(value: string | null): SidebarSection {
  if (value === "attachments" || value === "discussion") {
    return value;
  }
  return undefined;
}

export function TaskDetailPage() {
  const t = useTranslations("taskDetailOverlay");
  const pageT = useTranslations("taskDetailPage");
  const locale = useLocale();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const taskId = params?.taskId as string;
  const initialSection = toSidebarSection(searchParams.get("section"));

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [cls, setCls] = useState<ClassSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true });

  const formatDate = useCallback(
    (iso: string | null): string => {
      if (!iso) return "\u2014";
      return dateFormatter.format(new Date(iso));
    },
    [dateFormatter],
  );

  const loadData = useCallback(async () => {
    if (!taskId) return;

    setLoading(true);
    try {
      const taskData = await getTask(taskId);
      const classData = await getClass(taskData.classId);
      setTask(taskData);
      setCls(classData);
    } catch {
      setTask(null);
      setCls(null);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!taskId) return;
    void markTaskViewed(taskId).catch(() => {
      // Silently ignore
    });
  }, [taskId]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!task || !cls) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">{pageT("notFound")}</p>
      </div>
    );
  }

  const accentColor = cls.color || "#8B7355";
  const status: DetailStatus = deriveDetailStatus(task);
  const badge = getStatusBadge(status, accentColor, t);
  const isSubmitted = status === "submitted";
  const isAdmin = cls.myRole === "OWNER" || cls.myRole === "ADMIN";
  const attachments = (task.attachments ?? []).filter((attachment) =>
    isAdmin ? true : attachment.isVisible,
  );
  const bodyContent = task.description ?? "";

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
      <button
        type="button"
        onClick={() => router.push(`/classes/${task.classId}`)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={14} strokeWidth={2} />
        {pageT("backToClass")}
      </button>

      <div className="overflow-hidden rounded-[18px] border border-border bg-card shadow-sm">
        <div className="flex min-h-[calc(100vh-14rem)] overflow-hidden max-[700px]:flex-col">
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-border p-6">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: accentColor }}
                />
                <span
                  className="text-[12px] font-semibold"
                  style={{ color: accentColor }}
                >
                  {task.className}
                </span>
                <span
                  className="ml-1 inline-block rounded-md px-2.5 py-0.5 text-[11px] font-semibold"
                  style={{ backgroundColor: badge.bg, color: badge.text }}
                >
                  {badge.label}
                </span>
              </div>

              <h1 className="mt-2 font-serif text-2xl font-bold text-foreground">
                {task.title}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-4 text-[12.5px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calendar size={12.5} strokeWidth={1.8} />
                    {t("date.start")}: {formatDate(task.startAt)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar size={12.5} strokeWidth={1.8} />
                    {t("date.due")}: {formatDate(task.dueAt)}
                  </span>
                </div>

                <span
                  className={`text-[12.5px] ${
                    status === "overdue"
                      ? "font-semibold text-[#c45c5c]"
                      : "text-muted-foreground"
                  }`}
                >
                  {getFooterText(status, task.dueAt, t, formatDate)}
                </span>

                <div className="flex-1" />

                <div className="flex flex-wrap items-center gap-2">
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => router.push(`/tasks/${task.id}/edit`)}
                        className="rounded-lg border border-border bg-transparent px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors duration-100 hover:bg-secondary hover:text-foreground"
                      >
                        {t("actions.editTask")}
                      </button>
                      {task.stats?.submittedCount === 0 && (
                        <button
                          type="button"
                          disabled={deleting}
                          onClick={async () => {
                            if (!confirm(t("confirmDelete"))) return;
                            setDeleting(true);
                            try {
                              await deleteTask(task.id);
                              router.push(`/classes/${task.classId}`);
                            } catch {
                              setDeleting(false);
                            }
                          }}
                          className="rounded-lg border border-border bg-transparent px-3 py-1.5 text-[12px] font-medium text-destructive transition-colors duration-100 hover:bg-destructive/10 disabled:opacity-50"
                        >
                          {deleting
                            ? t("actions.deleting")
                            : t("actions.deleteTask")}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/tasks/${task.id}/submissions`)
                        }
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-white shadow-sm transition-colors duration-100"
                        style={{ backgroundColor: accentColor }}
                      >
                        {t("actions.viewSubmissions")}
                        <ArrowRight size={12} strokeWidth={2} />
                      </button>
                    </>
                  )}
                  {isSubmitted ? (
                    <span className="text-[12px] font-medium text-muted-foreground">
                      {t("actions.submitted")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => router.push(`/tasks/${task.id}/submit`)}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-white shadow-sm transition-colors duration-100"
                      style={{ backgroundColor: accentColor }}
                    >
                      {t("actions.submitAssignment")}
                      <ArrowRight size={12} strokeWidth={2} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {bodyContent ? (
                <MarkdownPreview
                  content={bodyContent}
                  accentColor={accentColor}
                />
              ) : (
                <p className="text-sm italic text-text-muted-soft">
                  {t("noDescription")}
                </p>
              )}
            </div>
          </div>

          <div className="w-[300px] shrink-0 border-l border-border max-[700px]:w-full max-[700px]:border-l-0 max-[700px]:border-t">
            <TaskSidebar
              attachments={attachments}
              taskId={task.id}
              accentColor={accentColor}
              initialSection={initialSection}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
