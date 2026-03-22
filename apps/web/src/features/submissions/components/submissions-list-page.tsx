"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Eye,
  FileSpreadsheet,
  Users,
  CheckCircle2,
  ClipboardCheck,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import type {
  ClassSummary,
  SubmissionListRow,
  TaskDetail,
} from "@/lib/api";
import {
  getClass,
  getTask,
  listSubmissions,
  exportSubmissionsCsv,
} from "@/lib/api";

// ─── Date formatting ─────────────────────────────────────────────────────────

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "\u2014";
  return dateFormatter.format(new Date(iso));
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SubmissionsListPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();

  const taskId = params?.taskId as string;

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [cls, setCls] = useState<ClassSummary | null>(null);
  const [rows, setRows] = useState<SubmissionListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // ─── Load data ──────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!token || !taskId) return;
    try {
      const [taskData, submissionRows] = await Promise.all([
        getTask(token, taskId),
        listSubmissions(token, taskId),
      ]);
      const classData = await getClass(token, taskData.classId);
      setTask(taskData);
      setCls(classData);
      setRows(submissionRows);
    } catch {
      toast.error("Failed to load submissions");
    } finally {
      setLoading(false);
    }
  }, [token, taskId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ─── Derived stats ─────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = rows.length;
    const submitted = rows.filter((r) => r.submitted).length;
    const graded = rows.filter(
      (r) => r.submission?.score !== null && r.submission?.score !== undefined,
    ).length;
    const scores = rows
      .filter(
        (r) => r.submission?.score !== null && r.submission?.score !== undefined,
      )
      .map((r) => parseFloat(r.submission!.score!));
    const avg =
      scores.length > 0
        ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
        : "\u2014";
    return { total, submitted, graded, avg };
  }, [rows]);

  // ─── CSV export ─────────────────────────────────────────────────────────────

  async function handleExport() {
    if (!token || !taskId) return;
    setExporting(true);
    try {
      const csv = await exportSubmissionsCsv(token, taskId);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const fileName = `${cls?.name ?? "class"}_${task?.title ?? "task"}_grades.csv`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("CSV exported successfully");
    } catch {
      toast.error("Failed to export CSV");
    } finally {
      setExporting(false);
    }
  }

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="mx-auto max-w-[960px] p-8">
        {/* Back button skeleton */}
        <div className="mb-6 h-5 w-32 animate-pulse rounded bg-muted" />
        {/* Title skeleton */}
        <div className="mb-8 h-9 w-80 animate-pulse rounded bg-muted" />
        {/* Stats bar skeleton */}
        <div className="mb-8 grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg bg-muted"
            />
          ))}
        </div>
        {/* Table skeleton */}
        <div className="space-y-2">
          <div className="h-10 animate-pulse rounded bg-muted" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded bg-muted"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!task || !cls) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Task or class not found.
        </p>
      </div>
    );
  }

  const accentColor = cls.color || "#7B6CB0";

  return (
    <div className="mx-auto max-w-[960px] p-8">
      {/* ── Back button ─────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => router.push(`/classes/${task?.classId ?? ""}`)}
        className="mb-6 flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors duration-100 hover:text-foreground"
      >
        <ArrowLeft size={14} strokeWidth={2} />
        Back to class
      </button>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-8 flex items-start justify-between gap-4">
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
              {cls.name}
            </span>
          </div>
          <h1 className="text-display">{task.title}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Submissions overview
          </p>
        </div>

        {/* Export button */}
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="flex shrink-0 items-center gap-2 rounded-[10px] border border-border bg-transparent px-4 py-2 text-[13px] font-medium text-muted-foreground transition-colors duration-100 hover:bg-secondary hover:text-foreground disabled:opacity-50"
        >
          <FileSpreadsheet size={14} strokeWidth={2} />
          {exporting ? "Exporting..." : "Export CSV"}
        </button>
      </div>

      {/* ── Stats bar ───────────────────────────────────────────────────── */}
      <div className="mb-8 grid grid-cols-4 gap-4">
        <StatCard
          icon={<Users size={16} strokeWidth={1.8} />}
          label="Total Members"
          value={String(stats.total)}
          accentColor={accentColor}
        />
        <StatCard
          icon={<CheckCircle2 size={16} strokeWidth={1.8} />}
          label="Submitted"
          value={String(stats.submitted)}
          accentColor="#5B8C6A"
        />
        <StatCard
          icon={<ClipboardCheck size={16} strokeWidth={1.8} />}
          label="Graded"
          value={String(stats.graded)}
          accentColor="#7B6CB0"
        />
        <StatCard
          icon={<BarChart3 size={16} strokeWidth={1.8} />}
          label="Average Score"
          value={stats.avg}
          accentColor="#C4785B"
        />
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-subtle/60">
              <th className="px-4 py-3 text-left text-[12px] font-semibold text-muted-foreground">
                Student
              </th>
              <th className="px-4 py-3 text-left text-[12px] font-semibold text-muted-foreground">
                Submitted
              </th>
              <th className="px-4 py-3 text-left text-[12px] font-semibold text-muted-foreground">
                Score
              </th>
              <th className="px-4 py-3 text-left text-[12px] font-semibold text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3 text-right text-[12px] font-semibold text-muted-foreground">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const hasSubmission = row.submitted && row.submission;
              const isGraded =
                row.submission?.score !== null &&
                row.submission?.score !== undefined;
              const displayName = row.nickname || row.email;

              return (
                <tr
                  key={row.userId}
                  className="group border-b border-border last:border-b-0 transition-colors duration-100 hover:bg-surface-subtle/40"
                >
                  {/* Student */}
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-[13px] font-medium text-foreground">
                        {displayName}
                      </p>
                      {row.nickname && (
                        <p className="text-[11px] text-muted-foreground">
                          {row.email}
                        </p>
                      )}
                    </div>
                  </td>

                  {/* Submitted date */}
                  <td className="px-4 py-3 text-[13px] text-muted-foreground">
                    {hasSubmission
                      ? formatDate(row.submission!.firstSubmittedAt)
                      : "\u2014"}
                  </td>

                  {/* Score */}
                  <td className="px-4 py-3">
                    {isGraded ? (
                      <span
                        className="font-serif text-[15px] font-semibold"
                        style={{ color: accentColor }}
                      >
                        {row.submission!.score}
                      </span>
                    ) : (
                      <span className="text-[13px] text-text-muted-soft">
                        {hasSubmission ? "Pending" : "\u2014"}
                      </span>
                    )}
                  </td>

                  {/* Status badge */}
                  <td className="px-4 py-3">
                    {isGraded ? (
                      <span
                        className="inline-block rounded-md px-2.5 py-0.5 text-[11px] font-semibold"
                        style={{
                          backgroundColor: "#7B6CB018",
                          color: "#7B6CB0",
                        }}
                      >
                        Graded
                      </span>
                    ) : hasSubmission ? (
                      <span
                        className="inline-block rounded-md px-2.5 py-0.5 text-[11px] font-semibold"
                        style={{
                          backgroundColor: "#5B8C6A18",
                          color: "#5B8C6A",
                        }}
                      >
                        Submitted
                      </span>
                    ) : (
                      <span className="inline-block rounded-md bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        Not Submitted
                      </span>
                    )}
                  </td>

                  {/* View action */}
                  <td className="px-4 py-3 text-right">
                    {hasSubmission ? (
                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/submissions/${row.submission!.id}`,
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12px] font-medium text-white transition-colors duration-100"
                        style={{ backgroundColor: accentColor }}
                      >
                        <Eye size={12} strokeWidth={2} />
                        View
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-[8px] bg-muted px-3 py-1.5 text-[12px] font-medium text-text-muted-soft">
                        <Eye size={12} strokeWidth={2} />
                        View
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-[13px] text-muted-foreground"
                >
                  No members found in this class.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  accentColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accentColor: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <span style={{ color: accentColor }}>{icon}</span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <p
        className="font-serif text-2xl font-bold"
        style={{ color: accentColor }}
      >
        {value}
      </p>
    </div>
  );
}
