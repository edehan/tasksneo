"use client";

import { Download, FileEdit } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { useAuth } from "@/components/auth-provider";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SubmissionListRow, TaskDetail } from "@/lib/api";
import {
  batchRenameSubmissions,
  exportSubmissionsCsv,
  getTask,
  listSubmissions,
} from "@/lib/api";

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SubmissionsListPage() {
  const { token } = useAuth();
  const params = useParams<{ classId: string; taskId: string }>();
  const { classId, taskId } = params;

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [rows, setRows] = useState<SubmissionListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [renaming, setRenaming] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [taskData, submissionRows] = await Promise.all([
        getTask(token, taskId),
        listSubmissions(token, taskId),
      ]);
      setTask(taskData);
      setRows(submissionRows);
    } catch {
      toast.error("Failed to load submissions");
    } finally {
      setLoading(false);
    }
  }, [token, taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submittedCount = rows.filter((r) => r.submitted).length;
  const totalCount = rows.length;
  const notSubmittedCount = totalCount - submittedCount;

  async function handleExport() {
    if (!token) return;
    setExporting(true);
    try {
      const csv = await exportSubmissionsCsv(token, taskId);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${task?.className ?? "class"}_${task?.title ?? "task"}_grades.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function handleBatchRename() {
    if (!token) return;
    setRenaming(true);
    try {
      await batchRenameSubmissions(token, taskId);
      toast.success("Attachments renamed");
    } catch {
      toast.error("Rename failed");
    } finally {
      setRenaming(false);
    }
  }

  return (
    <>
      <AppHeader title={`${task?.title ?? "Task"} — Submissions`} />
      <div className="mx-auto max-w-240 p-6 space-y-6">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-60 w-full" />
          </div>
        ) : !task ? (
          <p className="text-muted-foreground">Task not found.</p>
        ) : (
          <>
            <PageHeader title={`${task.title} — Submissions`}>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBatchRename}
                disabled={renaming}
              >
                <FileEdit className="mr-2 h-4 w-4" />
                {renaming ? "Renaming..." : "Batch rename"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExport}
                disabled={exporting}
              >
                <Download className="mr-2 h-4 w-4" />
                {exporting ? "Exporting..." : "Export CSV"}
              </Button>
            </PageHeader>

            {/* Stats bar */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>
                Total <strong className="text-foreground">{totalCount}</strong>
              </span>
              <span>·</span>
              <span>
                Submitted{" "}
                <strong className="text-foreground">{submittedCount}</strong>
              </span>
              <span>·</span>
              <span>
                Not submitted{" "}
                <strong className="text-foreground">{notSubmittedCount}</strong>
              </span>
            </div>

            {/* Submissions table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-36">Submitted</TableHead>
                    <TableHead className="w-36">Last updated</TableHead>
                    <TableHead className="w-20">Score</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.userId}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">
                            {row.nickname || row.email}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.schoolName && row.studentId
                              ? `${row.schoolName} · ${row.studentId}`
                              : row.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.submitted ? (
                          <Badge
                            variant="outline"
                            className="bg-status-success/10 text-status-success border-transparent"
                          >
                            Submitted
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-secondary text-secondary-foreground border-transparent"
                          >
                            Not submitted
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatTime(row.submission?.firstSubmittedAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatTime(row.submission?.lastUpdatedAt)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.submission?.score ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.submitted && row.submission && (
                          <Button asChild variant="ghost" size="sm">
                            <Link
                              href={`/classes/${classId}/tasks/${taskId}/submissions/${row.submission.id}`}
                            >
                              View
                            </Link>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
