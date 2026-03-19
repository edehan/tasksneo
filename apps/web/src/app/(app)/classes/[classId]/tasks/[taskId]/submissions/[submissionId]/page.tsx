"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { SubmissionDetail, SubmissionListRow } from "@/lib/api";
import {
  ApiError,
  getFileUrl,
  getSubmission,
  gradeSubmission,
  listSubmissions,
} from "@/lib/api";

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SubmissionDetailPage() {
  const { token } = useAuth();
  const params = useParams<{
    classId: string;
    taskId: string;
    submissionId: string;
  }>();
  const router = useRouter();
  const { classId, taskId, submissionId } = params;

  const [rows, setRows] = useState<SubmissionListRow[]>([]);
  const [submissionDetail, setSubmissionDetail] =
    useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Grading form
  const [score, setScore] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [data, detail] = await Promise.all([
        listSubmissions(token, taskId),
        getSubmission(token, taskId, submissionId),
      ]);

      setRows(data);
      setSubmissionDetail(detail);

      setScore(detail.score ?? "");
      setReviewNote(detail.reviewNote ?? "");
    } catch {
      toast.error("Failed to load submission");
      setSubmissionDetail(null);
    } finally {
      setLoading(false);
    }
  }, [token, taskId, submissionId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Find current submission and navigation
  const submittedRows = rows.filter((r) => r.submitted && r.submission);
  const currentIdx = submittedRows.findIndex(
    (r) => r.submission?.id === submissionId,
  );
  const current = currentIdx >= 0 ? submittedRows[currentIdx] : null;
  const prevRow = currentIdx > 0 ? submittedRows[currentIdx - 1] : null;
  const nextRow =
    currentIdx < submittedRows.length - 1
      ? submittedRows[currentIdx + 1]
      : null;
  const content = submissionDetail?.content ?? current?.submission?.content;
  const attachments = submissionDetail?.attachments ?? [];

  async function handleGrade() {
    if (!token) return;
    setSaving(true);
    try {
      await gradeSubmission(token, taskId, submissionId, {
        score: score.trim() || null,
        reviewNote: reviewNote.trim() || null,
      });
      toast.success("Grade saved");

      // Navigate to next if available
      if (nextRow?.submission) {
        router.push(
          `/classes/${classId}/tasks/${taskId}/submissions/${nextRow.submission.id}`,
        );
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save grade",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AppHeader title="Grade Submission" />
      <div className="mx-auto max-w-180 p-6 space-y-6">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : !current?.submission ? (
          <p className="text-muted-foreground">Submission not found.</p>
        ) : (
          <>
            {/* Navigation */}
            <div className="flex items-center justify-between">
              <Button asChild variant="ghost" size="sm">
                <Link href={`/classes/${classId}/tasks/${taskId}/submissions`}>
                  Back to list
                </Link>
              </Button>
              <div className="flex items-center gap-1">
                {prevRow?.submission ? (
                  <Button asChild variant="ghost" size="sm">
                    <Link
                      href={`/classes/${classId}/tasks/${taskId}/submissions/${prevRow.submission.id}`}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Previous
                    </Link>
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" disabled>
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Previous
                  </Button>
                )}
                <span className="text-sm text-muted-foreground px-2">
                  {currentIdx + 1} / {submittedRows.length}
                </span>
                {nextRow?.submission ? (
                  <Button asChild variant="ghost" size="sm">
                    <Link
                      href={`/classes/${classId}/tasks/${taskId}/submissions/${nextRow.submission.id}`}
                    >
                      Next
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" disabled>
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Student info */}
            <div className="rounded-lg border bg-muted/30 px-4 py-3">
              <p className="font-medium">{current.nickname || current.email}</p>
              <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span>{current.email}</span>
                {current.schoolName && <span>{current.schoolName}</span>}
                {current.studentId && <span>ID: {current.studentId}</span>}
              </div>
              <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                <span>
                  First submitted:{" "}
                  {formatTime(current.submission.firstSubmittedAt)}
                </span>
                <span>
                  Last updated: {formatTime(current.submission.lastUpdatedAt)}
                </span>
              </div>
            </div>

            {/* Submission content */}
            {content ? (
              <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg border p-4">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm italic text-muted-foreground">
                No text content submitted. Check attachments below.
              </p>
            )}

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Attachments</h3>
              {attachments.length > 0 ? (
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {attachments.map((att) => (
                    <li key={att.id}>
                      <a
                        href={getFileUrl(att.fileKey)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {att.renamedFile ?? att.originalName}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm italic text-muted-foreground">
                  No attachments submitted.
                </p>
              )}
            </div>

            <Separator />

            {/* Grading section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Grade</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="grade-score">Score</Label>
                  <Input
                    id="grade-score"
                    type="text"
                    inputMode="decimal"
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    placeholder="e.g. 85"
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="grade-note">Comment</Label>
                <Textarea
                  id="grade-note"
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Optional feedback for the student"
                  rows={3}
                  disabled={saving}
                />
              </div>

              {current.submission.reviewedAt && (
                <p className="text-xs text-muted-foreground">
                  Last graded: {formatTime(current.submission.reviewedAt)}
                </p>
              )}

              <Button onClick={handleGrade} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save grade
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
