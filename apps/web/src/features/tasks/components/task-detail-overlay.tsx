"use client";

import { ArrowRight, Calendar, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { MarkdownPreview } from "@/features/editor/components/markdown-preview";
import { AttachmentSidebar } from "@/features/tasks/components/attachment-sidebar";
import type { TaskWithClass } from "@/features/tasks/lib/task-utils";
import type { TaskDetail } from "@/lib/api";
import { deleteTask, getTask, markTaskViewed } from "@/lib/api";

// ─── Props ───────────────────────────────────────────────────────────────────

interface TaskDetailOverlayProps {
  task: TaskWithClass;
  onClose: () => void;
  onSubmit?: (task: TaskWithClass) => void;
  isAdmin?: boolean;
}

// ─── Status derivation ──────────────────────────────────────────────────────

type OverlayStatus = "submitted" | "overdue" | "in-progress" | "not-started";
type TranslateFn = ReturnType<typeof useTranslations>;

function deriveStatus(task: TaskWithClass): OverlayStatus {
  if (task.userState?.submittedAt) return "submitted";
  const now = Date.now();
  const dueAt = task.dueAt ? new Date(task.dueAt).getTime() : null;
  const startAt = task.startAt ? new Date(task.startAt).getTime() : null;
  if (dueAt && dueAt < now) return "overdue";
  if (startAt && startAt <= now && dueAt && dueAt >= now) return "in-progress";
  return "not-started";
}

function getStatusBadge(
  status: OverlayStatus,
  classColor: string,
  t: TranslateFn,
): { label: string; bg: string; text: string } {
  switch (status) {
    case "submitted":
      return { label: t("status.submitted"), bg: "#5B8C6A18", text: "#5B8C6A" };
    case "overdue":
      return { label: t("status.overdue"), bg: "#c45c5c18", text: "#c45c5c" };
    case "in-progress":
      return {
        label: t("status.inProgress"),
        bg: `${classColor}18`,
        text: classColor,
      };
    case "not-started":
      return {
        label: t("status.notStarted"),
        bg: "var(--muted)",
        text: "var(--muted-foreground)",
      };
  }
}

// ─── Footer status text ─────────────────────────────────────────────────────

function getFooterText(
  status: OverlayStatus,
  dueAt: string | null,
  t: TranslateFn,
  formatDate: (iso: string | null) => string,
): string {
  if (status === "submitted") return t("footer.submitted");
  if (status === "overdue") return t("footer.overdue");
  if (dueAt) return t("footer.dueAt", { date: formatDate(dueAt) });
  return t("footer.noDueDate");
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TaskDetailOverlay({
  task,
  onClose,
  onSubmit,
  isAdmin = false,
}: TaskDetailOverlayProps) {
  const t = useTranslations("taskDetailOverlay");
  const locale = useLocale();
  const { token } = useAuth();
  const router = useRouter();
  const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const formatDate = useCallback(
    (iso: string | null): string => {
      if (!iso) return "\u2014";
      return dateFormatter.format(new Date(iso));
    },
    [dateFormatter],
  );

  const status = deriveStatus(task);
  const badge = getStatusBadge(status, task.classColor, t);
  const isSubmitted = status === "submitted";

  // ─── Load full task detail ──────────────────────────────────────────────────

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function load() {
      try {
        const detail = await getTask(token!, task.id);
        if (!cancelled) {
          setTaskDetail(detail);
        }
      } catch {
        // Silently fail — the overlay will show a loading/empty state
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [token, task.id]);

  // ─── Mark as viewed (fire-and-forget) ───────────────────────────────────────

  useEffect(() => {
    if (!token) return;
    void markTaskViewed(token, task.id).catch(() => {
      // Silently ignore
    });
  }, [token, task.id]);

  // ─── Escape key ─────────────────────────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // ─── Click outside ─────────────────────────────────────────────────────────

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose],
  );

  // ─── Body scroll lock ──────────────────────────────────────────────────────

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const attachments = taskDetail?.attachments ?? [];
  const hasAttachments = attachments.length > 0;
  const bodyContent = taskDetail?.description ?? "";

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(4px)",
        animation: "custom-overlay-fade-in 0.2s ease",
      }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={task.title}
    >
      <div
        ref={modalRef}
        className="flex w-full max-w-[960px] flex-col overflow-hidden rounded-[18px] border border-border bg-card shadow-lg"
        style={{
          height: "85vh",
          maxHeight: "720px",
          animation: "custom-modal-enter 0.2s ease",
        }}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="relative shrink-0 border-b border-border p-6">
          {/* Row 1: Class + Status */}
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: task.classColor }}
            />
            <span
              className="text-[12px] font-semibold"
              style={{ color: task.classColor }}
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

          {/* Row 2: Title */}
          <h2 className="mt-2 font-serif text-2xl font-bold text-foreground">
            {task.title}
          </h2>

          {/* Row 3: Dates */}
          <div className="mt-2 flex items-center gap-4 text-[12.5px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar size={12.5} strokeWidth={1.8} />
              {t("date.start")}: {formatDate(task.startAt)}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar size={12.5} strokeWidth={1.8} />
              {t("date.due")}: {formatDate(task.dueAt)}
            </span>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-foreground"
            aria-label={t("close")}
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden max-[700px]:flex-col">
          {/* Content area */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <span className="text-sm text-muted-foreground">
                  {t("loading")}
                </span>
              </div>
            ) : bodyContent ? (
              <MarkdownPreview
                content={bodyContent}
                accentColor={task.classColor}
                authToken={token ?? undefined}
              />
            ) : (
              <p className="text-sm italic text-text-muted-soft">
                {t("noDescription")}
              </p>
            )}
          </div>

          {/* Attachment sidebar */}
          {hasAttachments && (
            <div className="w-[260px] shrink-0 border-l border-border max-[700px]:w-full max-[700px]:border-l-0 max-[700px]:border-t">
              <AttachmentSidebar
                attachments={attachments}
                accentColor={task.classColor}
              />
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between border-t border-border px-6 py-4">
          {/* Left: status text */}
          <span
            className={`text-[13px] ${
              status === "overdue"
                ? "font-semibold text-[#c45c5c]"
                : "text-muted-foreground"
            }`}
          >
            {getFooterText(status, task.dueAt, t, formatDate)}
          </span>

          {/* Right: action buttons */}
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push(`/tasks/${task.id}/edit`);
                  }}
                  className="rounded-[10px] border border-border bg-transparent px-4 py-2 text-[13px] font-medium text-muted-foreground transition-colors duration-100 hover:bg-secondary hover:text-foreground"
                >
                  {t("actions.editTask")}
                </button>
                {taskDetail?.stats?.submittedCount === 0 && (
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={async () => {
                      if (!token) return;
                      if (!confirm(t("confirmDelete"))) return;
                      setDeleting(true);
                      try {
                        await deleteTask(token, task.id);
                        onClose();
                      } catch {
                        setDeleting(false);
                      }
                    }}
                    className="rounded-[10px] border border-border bg-transparent px-4 py-2 text-[13px] font-medium text-destructive transition-colors duration-100 hover:bg-destructive/10 disabled:opacity-50"
                  >
                    {deleting ? t("actions.deleting") : t("actions.deleteTask")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push(`/tasks/${task.id}/submissions`);
                  }}
                  className="flex items-center gap-2 rounded-[10px] px-4 py-2 text-[13px] font-medium text-white shadow-sm transition-colors duration-100"
                  style={{ backgroundColor: task.classColor }}
                >
                  {t("actions.viewSubmissions")}
                  <ArrowRight size={14} strokeWidth={2} />
                </button>
              </>
            ) : isSubmitted ? (
              <button
                type="button"
                disabled
                className="flex cursor-not-allowed items-center gap-2 rounded-[10px] bg-secondary px-5 py-2.5 text-[13px] font-medium text-muted-foreground"
              >
                {t("actions.submitted")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (onSubmit) {
                    onSubmit(task);
                  } else {
                    onClose();
                    router.push(`/tasks/${task.id}/submit`);
                  }
                }}
                className="flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-[13px] font-medium text-white shadow-sm transition-colors duration-100"
                style={{ backgroundColor: task.classColor }}
              >
                {t("actions.submitAssignment")}
                <ArrowRight size={14} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
