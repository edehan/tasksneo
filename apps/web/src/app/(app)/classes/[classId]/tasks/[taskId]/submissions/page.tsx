"use client";

import { Download, RefreshCcw } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { formatDateTime } from "@/features/designer/format";
import {
  batchRenameSubmissions,
  exportSubmissionsCsv,
  getTask,
  listSubmissions,
  type SubmissionListRow,
  type TaskDetail,
} from "@/lib/api";

function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export default function SubmissionsPage() {
  const params = useParams<{ classId: string; taskId: string }>();
  const classId = params.classId;
  const taskId = params.taskId;

  const router = useRouter();
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [rows, setRows] = useState<SubmissionListRow[]>([]);
  const [busyExport, setBusyExport] = useState(false);
  const [busyRename, setBusyRename] = useState(false);

  useEffect(() => {
    if (!token) return;

    let active = true;
    setLoading(true);

    void Promise.all([getTask(token, taskId), listSubmissions(token, taskId)])
      .then(([taskRes, rowsRes]) => {
        if (!active) return;
        setTask(taskRes);
        setRows(rowsRes);
      })
      .catch(() => {
        if (active) {
          toast.error("加载提交列表失败");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [token, taskId]);

  const stats = useMemo(() => {
    const total = rows.length;
    const submitted = rows.filter((row) => row.submitted).length;
    return {
      total,
      submitted,
      notSubmitted: total - submitted,
    };
  }, [rows]);

  async function handleExport() {
    if (!token || !task) return;

    setBusyExport(true);
    try {
      const csv = await exportSubmissionsCsv(token, task.id);
      downloadText(csv, `${task.className || "班级"}_${task.title}_成绩.csv`);
    } catch {
      toast.error("CSV 导出失败");
    } finally {
      setBusyExport(false);
    }
  }

  async function handleRename() {
    if (!token || !task) return;

    setBusyRename(true);
    try {
      await batchRenameSubmissions(token, task.id);
      toast.success("已批量重命名附件");
    } catch {
      toast.error("批量重命名失败");
    } finally {
      setBusyRename(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "24px 32px", color: "var(--text-secondary)" }}>
        加载提交列表中...
      </div>
    );
  }

  if (!task) {
    return (
      <div style={{ padding: "24px 32px", color: "#c45c5c" }}>任务不存在</div>
    );
  }

  return (
    <div style={{ padding: "24px 28px 40px" }}>
      <div style={{ maxWidth: 1080 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div>
            <h1 style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.1 }}>
              {task.title} — 提交情况
            </h1>
            <p
              style={{
                marginTop: 6,
                color: "var(--text-secondary)",
                fontSize: 13,
              }}
            >
              总 {stats.total} 人 · 已提交 {stats.submitted} 人 · 未提交{" "}
              {stats.notSubmitted} 人
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="taskflow-btn"
              onClick={() => {
                void handleExport();
              }}
              disabled={busyExport}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Download size={14} />
              {busyExport ? "导出中..." : "导出 CSV"}
            </button>
            <button
              type="button"
              className="taskflow-btn"
              onClick={() => {
                void handleRename();
              }}
              disabled={busyRename}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <RefreshCcw size={14} />
              {busyRename ? "处理中..." : "批量重命名附件"}
            </button>
          </div>
        </div>

        <div
          className="taskflow-surface"
          style={{ marginTop: 14, overflow: "hidden" }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  background:
                    "color-mix(in srgb, var(--class-accent) 7%, transparent)",
                }}
              >
                {[
                  "昵称/邮箱",
                  "学校/学号",
                  "状态",
                  "首次提交",
                  "最后修改",
                  "成绩",
                  "操作",
                ].map((item) => (
                  <th
                    key={item}
                    style={{
                      textAlign: "left",
                      fontSize: 11,
                      color: "var(--text-secondary)",
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      padding: "9px 10px",
                      borderBottom: "1px solid var(--border-color)",
                    }}
                  >
                    {item}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.userId}
                  style={{ borderBottom: "1px solid var(--border-color)" }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.background =
                      "color-mix(in srgb, var(--class-accent) 7%, transparent)";
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.background = "transparent";
                  }}
                >
                  <td style={{ padding: "9px 10px" }}>
                    <div style={{ fontSize: 13 }}>
                      {row.nickname || row.email}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-secondary)",
                        marginTop: 2,
                      }}
                    >
                      {row.email}
                    </div>
                  </td>
                  <td
                    style={{
                      padding: "9px 10px",
                      fontSize: 12,
                      color: "var(--text-secondary)",
                    }}
                  >
                    {row.schoolName || "—"} / {row.studentId || "—"}
                  </td>
                  <td style={{ padding: "9px 10px" }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        borderRadius: 6,
                        padding: "3px 8px",
                        color: row.submitted
                          ? "#5B8C6A"
                          : "var(--text-secondary)",
                        background: row.submitted
                          ? "color-mix(in srgb, #5B8C6A 14%, transparent)"
                          : "color-mix(in srgb, var(--text-secondary) 10%, transparent)",
                      }}
                    >
                      {row.submitted ? "已提交" : "未提交"}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "9px 10px",
                      fontSize: 12,
                      color: "var(--text-secondary)",
                    }}
                  >
                    {row.submission
                      ? formatDateTime(row.submission.firstSubmittedAt)
                      : "—"}
                  </td>
                  <td
                    style={{
                      padding: "9px 10px",
                      fontSize: 12,
                      color: "var(--text-secondary)",
                    }}
                  >
                    {row.submission
                      ? formatDateTime(row.submission.lastUpdatedAt)
                      : "—"}
                  </td>
                  <td
                    style={{
                      padding: "9px 10px",
                      fontSize: 12,
                      color: "var(--text-secondary)",
                    }}
                  >
                    {row.submission?.score || "待批"}
                  </td>
                  <td style={{ padding: "9px 10px" }}>
                    <button
                      type="button"
                      className="taskflow-btn"
                      disabled={!row.submission}
                      onClick={() => {
                        if (!row.submission) return;
                        router.push(
                          `/classes/${classId}/tasks/${taskId}/submissions/${row.submission.id}`,
                        );
                      }}
                    >
                      查看
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
