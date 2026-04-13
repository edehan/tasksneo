"use client";

import {
  ArrowLeft,
  Award,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  FileSpreadsheet,
  Users,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import type { ClassSummary, SubmissionListRow, TaskDetail } from "@/lib/api";
import {
  ApiError,
  exportSubmissionsCsv,
  getClass,
  getTask,
  listSubmissions,
  toggleExemplary,
} from "@/lib/api";
import { BatchDownloadDialog } from "./batch-download-dialog";

// ─── Component ───────────────────────────────────────────────────────────────

export function SubmissionsListPage() {
  const t = useTranslations("submissionsListPage");
  const locale = useLocale();
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const taskId = params?.taskId as string;

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [cls, setCls] = useState<ClassSummary | null>(null);
  const [rows, setRows] = useState<SubmissionListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);

  const dateFormatter = new Intl.DateTimeFormat(locale, {
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

  // ─── Load data ──────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user || !taskId) return;
    try {
      const [taskData, submissionRows] = await Promise.all([
        getTask(taskId),
        listSubmissions(taskId),
      ]);
      const classData = await getClass(taskData.classId);
      setTask(taskData);
      setCls(classData);
      setRows(submissionRows);
    } catch {
      toast.error(t("toast.failedLoadSubmissions"));
    } finally {
      setLoading(false);
    }
  }, [user, taskId, t]);

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
        (r) =>
          r.submission?.score !== null && r.submission?.score !== undefined,
      )
      // biome-ignore lint/style/noNonNullAssertion: filtered above to ensure non-null
      .map((r) => parseFloat(r.submission!.score!));
    const avg =
      scores.length > 0
        ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
        : "\u2014";
    return { total, submitted, graded, avg };
  }, [rows]);

  // ─── CSV export ─────────────────────────────────────────────────────────────

  async function handleExport() {
    if (!user || !taskId) return;
    setExporting(true);
    try {
      const csv = await exportSubmissionsCsv(taskId);
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
      toast.success(t("toast.csvExported"));
    } catch {
      toast.error(t("toast.failedExportCsv"));
    } finally {
      setExporting(false);
    }
  }

  // ─── Toggle exemplary ──────────────────────────────────────────────────────

  async function handleToggleExemplary(
    submissionId: string,
    e: React.MouseEvent,
  ) {
    e.stopPropagation();
    if (!user || !taskId) return;
    try {
      const updated = await toggleExemplary(taskId, submissionId);
      setRows((prev) =>
        prev.map((row) =>
          row.submission?.id === submissionId
            ? {
                ...row,
                submission: {
                  ...row.submission,
                  isExemplary: updated.isExemplary,
                },
              }
            : row,
        ),
      );
      toast.success(
        updated.isExemplary
          ? t("toast.markedExemplary")
          : t("toast.unmarkedExemplary"),
      );
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : t("toast.failedToggleExemplary");
      toast.error(message);
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
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        {/* Table skeleton */}
        <div className="space-y-2">
          <div className="h-10 animate-pulse rounded bg-muted" />
          {Array.from({ length: 5 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder
            <div key={i} className="h-12 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!task || !cls) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("notFound")}</p>
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
        {t("backToClass")}
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
            {t("subtitle")}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setDownloadDialogOpen(true)}
            className="flex items-center gap-2 rounded-[10px] border border-border bg-transparent px-4 py-2 text-[13px] font-medium text-muted-foreground transition-colors duration-100 hover:bg-secondary hover:text-foreground"
          >
            <Download size={14} strokeWidth={2} />
            {t("actions.download")}
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 rounded-[10px] border border-border bg-transparent px-4 py-2 text-[13px] font-medium text-muted-foreground transition-colors duration-100 hover:bg-secondary hover:text-foreground disabled:opacity-50"
          >
            <FileSpreadsheet size={14} strokeWidth={2} />
            {exporting ? t("actions.exporting") : t("actions.exportCsv")}
          </button>
        </div>
      </div>

      {/* ── Stats bar ───────────────────────────────────────────────────── */}
      <div className="mb-8 grid grid-cols-4 gap-4">
        <StatCard
          icon={<Users size={16} strokeWidth={1.8} />}
          label={t("stats.totalMembers")}
          value={String(stats.total)}
          accentColor={accentColor}
        />
        <StatCard
          icon={<CheckCircle2 size={16} strokeWidth={1.8} />}
          label={t("stats.submitted")}
          value={String(stats.submitted)}
          accentColor="#5B8C6A"
        />
        <StatCard
          icon={<ClipboardCheck size={16} strokeWidth={1.8} />}
          label={t("stats.graded")}
          value={String(stats.graded)}
          accentColor="#7B6CB0"
        />
        <StatCard
          icon={<BarChart3 size={16} strokeWidth={1.8} />}
          label={t("stats.averageScore")}
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
                {t("table.student")}
              </th>
              <th className="px-4 py-3 text-left text-[12px] font-semibold text-muted-foreground">
                {t("table.submitted")}
              </th>
              <th className="px-4 py-3 text-left text-[12px] font-semibold text-muted-foreground">
                {t("table.score")}
              </th>
              <th className="px-4 py-3 text-left text-[12px] font-semibold text-muted-foreground">
                {t("table.status")}
              </th>
              <th className="px-4 py-3 text-right text-[12px] font-semibold text-muted-foreground">
                {t("table.action")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const hasSubmission = row.submitted && row.submission;
              const isGraded =
                row.submission?.score !== null &&
                row.submission?.score !== undefined;
              const displayName = row.nickname || row.studentId || "Student";

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
                      {row.studentId && (
                        <p className="text-[11px] text-muted-foreground">
                          {row.studentId}
                        </p>
                      )}
                    </div>
                  </td>

                  {/* Submitted date */}
                  <td className="px-4 py-3 text-[13px] text-muted-foreground">
                    {hasSubmission
                      ? formatDate(row.submission?.firstSubmittedAt)
                      : "\u2014"}
                  </td>

                  {/* Score */}
                  <td className="px-4 py-3">
                    {isGraded ? (
                      <span
                        className="font-serif text-[15px] font-semibold"
                        style={{ color: accentColor }}
                      >
                        {row.submission?.score}
                      </span>
                    ) : (
                      <span className="text-[13px] text-text-muted-soft">
                        {hasSubmission ? t("table.pending") : "\u2014"}
                      </span>
                    )}
                  </td>

                  {/* Status badge */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {isGraded ? (
                        <span
                          className="inline-block rounded-md px-2.5 py-0.5 text-[11px] font-semibold"
                          style={{
                            backgroundColor: "#7B6CB018",
                            color: "#7B6CB0",
                          }}
                        >
                          {t("status.graded")}
                        </span>
                      ) : hasSubmission ? (
                        <span
                          className="inline-block rounded-md px-2.5 py-0.5 text-[11px] font-semibold"
                          style={{
                            backgroundColor: "#5B8C6A18",
                            color: "#5B8C6A",
                          }}
                        >
                          {t("status.submitted")}
                        </span>
                      ) : (
                        <span className="inline-block rounded-md bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          {t("status.notSubmitted")}
                        </span>
                      )}
                      {row.submission?.isExemplary && (
                        <span
                          className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
                          style={{
                            backgroundColor: "#d97706" + "18",
                            color: "#d97706",
                          }}
                          title={t("status.exemplary")}
                        >
                          <Award size={10} strokeWidth={2.5} />
                        </span>
                      )}
                    </div>
                  </td>

                  {/* View + Exemplary actions */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {hasSubmission && isGraded && (
                        <button
                          type="button"
                          onClick={(e) =>
                            // biome-ignore lint/style/noNonNullAssertion: guarded by hasSubmission && isGraded
                            handleToggleExemplary(row.submission!.id, e)
                          }
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-[8px] transition-colors duration-100 ${
                            row.submission?.isExemplary
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-secondary text-muted-foreground hover:text-foreground"
                          }`}
                          title={
                            row.submission?.isExemplary
                              ? t("table.unmarkExemplary")
                              : t("table.markExemplary")
                          }
                        >
                          <Award size={13} strokeWidth={2} />
                        </button>
                      )}
                      {hasSubmission ? (
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/submissions/${row.submission?.id}`)
                          }
                          className="inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12px] font-medium text-white transition-colors duration-100"
                          style={{ backgroundColor: accentColor }}
                        >
                          <Eye size={12} strokeWidth={2} />
                          {t("table.view")}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-[8px] bg-muted px-3 py-1.5 text-[12px] font-medium text-text-muted-soft">
                          <Eye size={12} strokeWidth={2} />
                          {t("table.view")}
                        </span>
                      )}
                    </div>
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
                  {t("table.noMembers")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Batch download dialog ─────────────────────────────────────── */}
      <BatchDownloadDialog
        open={downloadDialogOpen}
        onOpenChange={setDownloadDialogOpen}
        rows={rows}
        task={task}
        cls={cls}
        accentColor={accentColor}
      />
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
