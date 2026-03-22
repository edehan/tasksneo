"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Save,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { MarkdownPreview } from "@/features/editor/components/markdown-preview";
import type {
  ClassSummary,
  SubmissionDetail,
  SubmissionListRow,
} from "@/lib/api";
import {
  getClass,
  getSubmission,
  getTask,
  gradeSubmission,
  listSubmissions,
  getFileUrl,
} from "@/lib/api";

// ─── Date formatting ─────────────────────────────────────────────────────────

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "\u2014";
  return dateFormatter.format(new Date(iso));
}

// ─── File size formatting ────────────────────────────────────────────────────

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SubmissionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();

  const classId = params?.classId as string;
  const taskId = params?.taskId as string;
  const submissionId = params?.submissionId as string;

  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [cls, setCls] = useState<ClassSummary | null>(null);
  const [allRows, setAllRows] = useState<SubmissionListRow[]>([]);
  const [taskTitle, setTaskTitle] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Grading form state
  const [score, setScore] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [saving, setSaving] = useState(false);

  // ─── Load data ──────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!token || !classId || !taskId || !submissionId) return;
    try {
      const [submissionData, classData, taskData, submissionRows] =
        await Promise.all([
          getSubmission(token, taskId, submissionId),
          getClass(token, classId),
          getTask(token, taskId),
          listSubmissions(token, taskId),
        ]);
      setSubmission(submissionData);
      setCls(classData);
      setTaskTitle(taskData.title);
      setAllRows(submissionRows);

      // Initialize grading form with existing values
      setScore(submissionData.score ?? "");
      setReviewNote(submissionData.reviewNote ?? "");
    } catch {
      toast.error("Failed to load submission");
    } finally {
      setLoading(false);
    }
  }, [token, classId, taskId, submissionId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ─── Student info from row list ─────────────────────────────────────────────

  const studentRow = useMemo(() => {
    if (!submission) return null;
    return allRows.find((r) => r.submission?.id === submissionId) ?? null;
  }, [allRows, submission, submissionId]);

  // ─── Prev/Next navigation ──────────────────────────────────────────────────

  const submittedRows = useMemo(
    () => allRows.filter((r) => r.submitted && r.submission),
    [allRows],
  );

  const currentIndex = useMemo(
    () => submittedRows.findIndex((r) => r.submission?.id === submissionId),
    [submittedRows, submissionId],
  );

  const prevSubmission =
    currentIndex > 0 ? submittedRows[currentIndex - 1] : null;
  const nextSubmission =
    currentIndex < submittedRows.length - 1
      ? submittedRows[currentIndex + 1]
      : null;

  function navigateTo(row: SubmissionListRow) {
    if (!row.submission) return;
    router.push(
      `/classes/${classId}/tasks/${taskId}/submissions/${row.submission.id}`,
    );
  }

  // ─── Save grade ─────────────────────────────────────────────────────────────

  async function handleSaveGrade() {
    if (!token || !taskId || !submissionId) return;
    setSaving(true);
    try {
      const updated = await gradeSubmission(token, taskId, submissionId, {
        score: score.trim() || null,
        reviewNote: reviewNote.trim() || null,
      });
      setSubmission(updated);
      toast.success("Grade saved successfully");
    } catch {
      toast.error("Failed to save grade");
    } finally {
      setSaving(false);
    }
  }

  // ─── Attachment download ──────────────────────────────────────────────────

  function handleDownload(att: {
    fileKey: string;
    originalName: string;
    url: string;
  }) {
    const url = att.url || getFileUrl(att.fileKey);
    const link = document.createElement("a");
    link.href = url;
    link.download = att.originalName;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="mx-auto max-w-[960px] p-8">
        {/* Back button skeleton */}
        <div className="mb-6 h-5 w-48 animate-pulse rounded bg-muted" />
        {/* Header skeleton */}
        <div className="mb-8 space-y-3">
          <div className="h-8 w-64 animate-pulse rounded bg-muted" />
          <div className="h-4 w-96 animate-pulse rounded bg-muted" />
        </div>
        {/* Content skeleton */}
        <div className="mb-8 space-y-3">
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        </div>
        {/* Grading panel skeleton */}
        <div className="h-48 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (!submission || !cls) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Submission not found.</p>
      </div>
    );
  }

  const accentColor = cls.color || "#7B6CB0";
  const displayName = studentRow?.nickname || studentRow?.email || "Student";
  const attachments = submission.attachments ?? [];

  return (
    <div className="mx-auto max-w-[960px] p-8">
      {/* ── Back + Prev/Next ────────────────────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() =>
            router.push(
              `/classes/${classId}/tasks/${taskId}/submissions`,
            )
          }
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors duration-100 hover:text-foreground"
        >
          <ArrowLeft size={14} strokeWidth={2} />
          Back to submissions
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!prevSubmission}
            onClick={() => prevSubmission && navigateTo(prevSubmission)}
            className="flex items-center gap-1 rounded-[8px] border border-border px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors duration-100 hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={14} strokeWidth={2} />
            Prev
          </button>
          <span className="text-[12px] text-muted-foreground">
            {currentIndex >= 0
              ? `${currentIndex + 1} / ${submittedRows.length}`
              : ""}
          </span>
          <button
            type="button"
            disabled={!nextSubmission}
            onClick={() => nextSubmission && navigateTo(nextSubmission)}
            className="flex items-center gap-1 rounded-[8px] border border-border px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors duration-100 hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <ChevronRight size={14} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* ── Header: Student info ────────────────────────────────────────── */}
      <div className="mb-8 rounded-lg border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: accentColor }}
              />
              <span
                className="text-[12px] font-semibold"
                style={{ color: accentColor }}
              >
                {taskTitle}
              </span>
            </div>
            <h1 className="text-display">{displayName}</h1>
            {studentRow?.nickname && (
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {studentRow.email}
              </p>
            )}
            {(studentRow?.schoolName || studentRow?.studentId) && (
              <p className="mt-0.5 text-[12px] text-text-muted-soft">
                {[studentRow.schoolName, studentRow.studentId]
                  .filter(Boolean)
                  .join(" \u00B7 ")}
              </p>
            )}
          </div>

          <div className="shrink-0 text-right">
            <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <Clock size={12} strokeWidth={1.8} />
              First submitted: {formatDate(submission.firstSubmittedAt)}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <Clock size={12} strokeWidth={1.8} />
              Last updated: {formatDate(submission.lastUpdatedAt)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Submission content ──────────────────────────────────────────── */}
      <div className="mb-8">
        <h2 className="text-heading-md mb-4">Submission Content</h2>
        <div className="rounded-lg border border-border bg-card p-6">
          {submission.content ? (
            <MarkdownPreview
              content={submission.content}
              accentColor={accentColor}
            />
          ) : (
            <p className="text-sm italic text-text-muted-soft">
              No text content submitted.
            </p>
          )}
        </div>
      </div>

      {/* ── Attachments ─────────────────────────────────────────────────── */}
      {attachments.length > 0 && (
        <div className="mb-8">
          <h2 className="text-heading-md mb-4">
            Attachments ({attachments.length})
          </h2>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="space-y-1.5">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-100 hover:bg-surface-subtle/60"
                >
                  <FileText
                    size={18}
                    strokeWidth={1.8}
                    className="shrink-0 text-muted-foreground"
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-[13px] font-medium text-foreground"
                      title={att.originalName}
                    >
                      {att.originalName}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatFileSize(att.sizeBytes)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownload(att)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground transition-colors duration-100 hover:text-foreground"
                    aria-label={`Download ${att.originalName}`}
                  >
                    <Download size={14} strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Grading panel ───────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-heading-md mb-4">Grading</h2>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Score input */}
          <div>
            <label
              htmlFor="score-input"
              className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Score
            </label>
            <input
              id="score-input"
              type="number"
              step="any"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="e.g. 95.5"
              className="h-10 w-full rounded-[8px] border border-border bg-background px-3 text-[14px] text-foreground outline-none transition-colors duration-100 placeholder:text-text-muted-soft focus:border-transparent focus:ring-2 focus:ring-class-accent"
            />
          </div>

          {/* Reviewed info */}
          {submission.reviewedAt && (
            <div className="flex items-end">
              <p className="text-[12px] text-muted-foreground">
                Last reviewed: {formatDate(submission.reviewedAt)}
              </p>
            </div>
          )}
        </div>

        {/* Review note */}
        <div className="mt-4">
          <label
            htmlFor="review-note"
            className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Review Note
          </label>
          <textarea
            id="review-note"
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            placeholder="Optional feedback for the student..."
            rows={4}
            className="w-full resize-none rounded-[8px] border border-border bg-background px-3 py-2.5 text-[14px] leading-relaxed text-foreground outline-none transition-colors duration-100 placeholder:text-text-muted-soft focus:border-transparent focus:ring-2 focus:ring-class-accent"
          />
        </div>

        {/* Save button */}
        <div className="mt-5 flex items-center justify-end">
          <button
            type="button"
            onClick={handleSaveGrade}
            disabled={saving}
            className="flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-[13px] font-medium text-white shadow-sm transition-colors duration-100 disabled:opacity-50"
            style={{ backgroundColor: accentColor }}
          >
            <Save size={14} strokeWidth={2} />
            {saving ? "Saving..." : "Save Grade"}
          </button>
        </div>
      </div>
    </div>
  );
}
