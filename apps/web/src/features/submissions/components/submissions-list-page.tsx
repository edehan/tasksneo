"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Award,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  ClipboardCheck,
  Download,
  Eye,
  FileSpreadsheet,
  Users,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import type { ClassSummary, SubmissionListRow, TaskDetail } from "@/lib/api";
import { ApiError, exportSubmissionsCsv, toggleExemplary } from "@/lib/api";
import {
  useClassQuery,
  useTaskQuery,
  useTaskSubmissionsQuery,
} from "@/lib/web-data";
import { BatchDownloadDialog } from "./batch-download-dialog";

// ─── Component ───────────────────────────────────────────────────────────────

interface SubmissionsListPageProps {
  initialTask: TaskDetail | null;
  initialClass: ClassSummary | null;
  initialRows: SubmissionListRow[];
}

type SortKey = "student" | "read" | "submitted" | "score" | "status";
type SortDirection = "asc" | "desc";

interface SortState {
  key: SortKey | null;
  direction: SortDirection | null;
}

function getDisplayName(row: SubmissionListRow) {
  return row.nickname || row.studentId || "Student";
}

function getStatusRank(row: SubmissionListRow) {
  if (row.submission?.score !== null && row.submission?.score !== undefined) {
    return 2;
  }
  if (row.submitted && row.submission) return 1;
  return 0;
}

export function SubmissionsListPage({
  initialTask,
  initialClass,
  initialRows,
}: SubmissionsListPageProps) {
  const t = useTranslations("submissionsListPage");
  const locale = useLocale();
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();

  const taskId = params?.taskId as string;

  const [exporting, setExporting] = useState(false);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [sort, setSort] = useState<SortState>({
    key: null,
    direction: null,
  });

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    timeZone: user?.timezone ?? "UTC",
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

  const { data: task, isLoading: taskLoading } = useTaskQuery(taskId, {
    fallbackData: initialTask ?? undefined,
  });
  const { data: cls, isLoading: classLoading } = useClassQuery(
    task?.classId ?? initialTask?.classId,
    {
      fallbackData: initialClass ?? undefined,
    },
  );
  const {
    data: rows = initialRows,
    isLoading: rowsLoading,
    mutate: mutateRows,
  } = useTaskSubmissionsQuery(taskId, {
    fallbackData: initialRows,
  });

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

  const sortedRows = useMemo(() => {
    if (!sort.key || !sort.direction) return rows;

    const direction = sort.direction;
    const compareMissingLast = <T,>(
      a: T | null | undefined,
      b: T | null | undefined,
      compare: (left: T, right: T) => number,
    ) => {
      const aMissing = a === null || a === undefined;
      const bMissing = b === null || b === undefined;
      if (aMissing && bMissing) return 0;
      if (aMissing) return 1;
      if (bMissing) return -1;
      const result = compare(a, b);
      return direction === "asc" ? result : -result;
    };

    return [...rows].sort((a, b) => {
      switch (sort.key) {
        case "student":
          return direction === "asc"
            ? getDisplayName(a).localeCompare(getDisplayName(b), locale)
            : getDisplayName(b).localeCompare(getDisplayName(a), locale);
        case "read": {
          const result =
            Number(Boolean(a.viewedAt)) - Number(Boolean(b.viewedAt));
          return direction === "asc" ? result : -result;
        }
        case "submitted":
          return compareMissingLast(
            a.submission?.firstSubmittedAt,
            b.submission?.firstSubmittedAt,
            (left, right) =>
              new Date(left).getTime() - new Date(right).getTime(),
          );
        case "score":
          return compareMissingLast(
            a.submission?.score ? Number.parseFloat(a.submission.score) : null,
            b.submission?.score ? Number.parseFloat(b.submission.score) : null,
            (left, right) => left - right,
          );
        case "status": {
          const result = getStatusRank(a) - getStatusRank(b);
          return direction === "asc" ? result : -result;
        }
        default:
          return 0;
      }
    });
  }, [locale, rows, sort]);

  function handleSort(key: SortKey) {
    setSort((current) => {
      if (current.key !== key || current.direction === null) {
        return { key, direction: "asc" };
      }
      if (current.direction === "asc") {
        return { key, direction: "desc" };
      }
      return { key: null, direction: null };
    });
  }

  // ─── CSV export ─────────────────────────────────────────────────────────────

  async function handleExport() {
    if (!taskId) return;
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
    if (!taskId) return;
    try {
      const updated = await toggleExemplary(taskId, submissionId);
      await mutateRows(
        (prev = initialRows) =>
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
        false,
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

  if (taskLoading || classLoading || rowsLoading) {
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

  function SortableHeader({
    sortKey,
    label,
    align = "left",
  }: {
    sortKey: SortKey;
    label: string;
    align?: "left" | "center";
  }) {
    const active = sort.key === sortKey && sort.direction !== null;
    const Icon = active
      ? sort.direction === "asc"
        ? ArrowUp
        : ArrowDown
      : ChevronsUpDown;

    return (
      <th
        className={`px-4 py-3 text-[12px] font-semibold text-muted-foreground ${
          align === "center" ? "text-center" : "text-left"
        }`}
      >
        <button
          type="button"
          onClick={() => handleSort(sortKey)}
          className={`inline-flex items-center gap-1 rounded-md text-[12px] font-semibold transition-colors hover:text-foreground ${
            align === "center" ? "justify-center" : ""
          }`}
          style={active ? { color: accentColor } : undefined}
          aria-label={`${label} sort`}
          title={label}
        >
          <span>{label}</span>
          <Icon size={12} strokeWidth={2} />
        </button>
      </th>
    );
  }

  return (
    <div className="mx-auto max-w-[1080px] p-8">
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
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-subtle/60">
              <SortableHeader sortKey="student" label={t("table.student")} />
              <SortableHeader
                sortKey="read"
                label={t("table.read")}
                align="center"
              />
              <SortableHeader
                sortKey="submitted"
                label={t("table.submitted")}
              />
              <SortableHeader sortKey="score" label={t("table.score")} />
              <SortableHeader sortKey="status" label={t("table.status")} />
              <th className="px-4 py-3 text-right text-[12px] font-semibold text-muted-foreground">
                {t("table.action")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const hasSubmission = row.submitted && row.submission;
              const isGraded =
                row.submission?.score !== null &&
                row.submission?.score !== undefined;
              const displayName = getDisplayName(row);

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

                  {/* Read */}
                  <td className="px-4 py-3 text-center">
                    {row.viewedAt && (
                      <Check
                        size={15}
                        strokeWidth={2.5}
                        className="mx-auto"
                        style={{ color: accentColor }}
                        aria-label={t("table.read")}
                      />
                    )}
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
                  colSpan={6}
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
