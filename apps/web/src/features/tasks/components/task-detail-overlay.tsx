"use client";

import { ArrowRight, Calendar, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { AttachmentList } from "@/features/tasks/components/attachment-list";
import { MarkdownRenderer } from "@/features/tasks/components/markdown-renderer";
import type { TaskWithClass } from "@/features/tasks/lib/task-utils";
import {
  displayStatusConfig,
  formatDateTime,
  getDisplayStatus,
} from "@/features/tasks/lib/task-utils";
import type { TaskDetail } from "@/lib/api";
import { getTask } from "@/lib/api";

interface TaskDetailOverlayProps {
  task: TaskWithClass;
  onClose: () => void;
}

export function TaskDetailOverlay({ task, onClose }: TaskDetailOverlayProps) {
  const { token } = useAuth();
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDetail = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getTask(token, task.id);
      setDetail(data);
    } catch {
      // Show basic info from summary
    } finally {
      setLoading(false);
    }
  }, [token, task.id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const status = getDisplayStatus(task);
  const cfg = displayStatusConfig[status];
  const isSubmitted = status === "submitted";
  const hasAttachments = (detail?.attachments?.length ?? 0) > 0;

  const statusFooterText = isSubmitted
    ? "You have already submitted this assignment."
    : status === "overdue"
      ? "This assignment is past due."
      : `Due ${formatDateTime(task.dueAt)}`;

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-center justify-center p-4"
      style={{
        background: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(5px)",
        animation: "fadeOverlay 0.2s ease",
      }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[720px] w-full max-w-[960px] flex-col overflow-hidden rounded-[18px] border border-border bg-card shadow-2xl"
        style={{
          height: "85vh",
          animation: "fadeIn 0.2s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-border px-7 pb-4 pt-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              {/* Class badge + status */}
              <div className="mb-2.5 flex items-center gap-2.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-[3px]"
                  style={{ backgroundColor: task.classColor }}
                />
                <span
                  className="text-xs font-semibold"
                  style={{ color: task.classColor }}
                >
                  {task.className}
                </span>
                <span
                  className={`rounded-md px-2.5 py-0.5 text-[11px] font-semibold ${cfg.colorClass}`}
                >
                  {cfg.label}
                </span>
              </div>
              {/* Title */}
              <h2 className="font-serif text-2xl font-bold leading-tight tracking-tight text-foreground">
                {task.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>

          {/* Dates row */}
          <div className="mt-3 flex flex-wrap gap-5 text-[12.5px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-[15px] w-[15px]" />
              Start:{" "}
              <strong className="font-semibold text-foreground">
                {formatDateTime(task.startAt)}
              </strong>
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-[15px] w-[15px]" />
              Due:{" "}
              <strong
                className={`font-semibold ${status === "overdue" ? "text-[#c45c5c]" : "text-foreground"}`}
              >
                {formatDateTime(task.dueAt)}
              </strong>
            </span>
          </div>
        </div>

        {/* Body + Sidebar */}
        <div className="flex flex-1 overflow-hidden max-md:flex-col">
          {/* Main markdown body */}
          <div className="min-w-0 flex-1 overflow-y-auto px-7 py-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
              </div>
            ) : detail?.description ? (
              <MarkdownRenderer content={detail.description} />
            ) : (
              <p className="text-sm italic text-text-muted">
                {task.sourceText ?? "No description provided."}
              </p>
            )}
          </div>

          {/* Attachment sidebar */}
          {hasAttachments && detail && (
            <div className="w-full shrink-0 border-l border-border bg-sidebar md:w-[260px] max-md:border-l-0 max-md:border-t">
              <AttachmentList attachments={detail.attachments} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-border px-7 py-4">
          <span className="text-xs text-text-muted">{statusFooterText}</span>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-[10px] px-7 py-2.5 text-sm font-bold text-white transition-all"
            style={{
              backgroundColor: isSubmitted
                ? "var(--muted)"
                : task.classColor,
              color: isSubmitted ? "var(--text-muted)" : "#fff",
              cursor: isSubmitted ? "default" : "pointer",
              boxShadow: isSubmitted
                ? "none"
                : `0 3px 16px ${task.classColor}40`,
            }}
            disabled={isSubmitted}
          >
            {isSubmitted ? "Submitted" : "Submit Assignment"}
            <ArrowRight className="h-[15px] w-[15px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
