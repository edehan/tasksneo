"use client";

import { ArrowLeft, ArrowRight, Download } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { filesizeLabel, formatDateTime } from "@/features/designer/format";
import { MarkdownContent } from "@/features/designer/markdown-content";
import {
  getFileUrl,
  getSubmission,
  getTask,
  gradeSubmission,
  listSubmissions,
  type SubmissionDetail,
  type SubmissionListRow,
  type TaskDetail,
} from "@/lib/api";

export default function SubmissionDetailPage() {
  const params = useParams<{
    classId: string;
    taskId: string;
    submissionId: string;
  }>();
  const classId = params.classId;
  const taskId = params.taskId;
  const submissionId = params.submissionId;

  const router = useRouter();
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [rows, setRows] = useState<SubmissionListRow[]>([]);

  const [score, setScore] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;

    let active = true;
    setLoading(true);

    void Promise.all([
      getTask(token, taskId),
      getSubmission(token, taskId, submissionId),
      listSubmissions(token, taskId),
    ])
      .then(([taskRes, submissionRes, rowsRes]) => {
        if (!active) return;

        setTask(taskRes);
        setSubmission(submissionRes);
        setRows(rowsRes);
        setScore(submissionRes.score || "");
        setReviewNote(submissionRes.reviewNote || "");
      })
      .catch(() => {
        if (active) {
          toast.error("加载提交详情失败");
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
  }, [token, taskId, submissionId]);

  const submittedRows = useMemo(
    () => rows.filter((row) => row.submitted && row.submission),
    [rows],
  );
  const currentIndex = submittedRows.findIndex(
    (row) => row.submission?.id === submissionId,
  );
  const prevSubmissionId =
    currentIndex > 0 ? submittedRows[currentIndex - 1]?.submission?.id : null;
  const nextSubmissionId =
    currentIndex >= 0 && currentIndex < submittedRows.length - 1
      ? submittedRows[currentIndex + 1]?.submission?.id
      : null;

  const currentRow =
    rows.find((row) => row.submission?.id === submissionId) || null;

  async function handleSaveGrade() {
    if (!token || !submission) return;

    setSaving(true);
    try {
      const updated = await gradeSubmission(token, taskId, submission.id, {
        score: score.trim() || null,
        reviewNote: reviewNote.trim() || null,
      });
      setSubmission((prev) =>
        prev
          ? {
              ...prev,
              score: updated.score,
              reviewNote: updated.reviewNote,
              reviewedAt: updated.reviewedAt,
              reviewerId: updated.reviewerId,
            }
          : prev,
      );
      toast.success("评分已保存");
    } catch {
      toast.error("评分保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "24px 32px", color: "var(--text-secondary)" }}>
        加载提交详情中...
      </div>
    );
  }

  if (!task || !submission) {
    return (
      <div style={{ padding: "24px 32px", color: "#c45c5c" }}>提交不存在</div>
    );
  }

  return (
    <div
      style={{
        padding: "24px 24px 40px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 900 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <Link
            className="taskflow-btn"
            href={`/classes/${classId}/tasks/${taskId}/submissions`}
          >
            返回列表
          </Link>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="taskflow-btn"
              disabled={!prevSubmissionId}
              onClick={() => {
                if (!prevSubmissionId) return;
                router.push(
                  `/classes/${classId}/tasks/${taskId}/submissions/${prevSubmissionId}`,
                );
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <ArrowLeft size={14} />
              上一份
            </button>
            <button
              type="button"
              className="taskflow-btn"
              disabled={!nextSubmissionId}
              onClick={() => {
                if (!nextSubmissionId) return;
                router.push(
                  `/classes/${classId}/tasks/${taskId}/submissions/${nextSubmissionId}`,
                );
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              下一份
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        <div
          className="taskflow-surface"
          style={{ marginTop: 12, padding: 16 }}
        >
          <h1 style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1 }}>
            {task.title}
          </h1>
          <p
            style={{
              marginTop: 8,
              color: "var(--text-secondary)",
              fontSize: 12,
            }}
          >
            {currentRow?.nickname || currentRow?.email || submission.userId} ·{" "}
            {currentRow?.email || "—"}
          </p>
          <p
            style={{
              marginTop: 4,
              color: "var(--text-secondary)",
              fontSize: 12,
            }}
          >
            {currentRow?.schoolName || "—"} / {currentRow?.studentId || "—"}
          </p>
          <p
            style={{
              marginTop: 4,
              color: "var(--text-secondary)",
              fontSize: 12,
            }}
          >
            首次提交：{formatDateTime(submission.firstSubmittedAt)} · 最后修改：
            {formatDateTime(submission.lastUpdatedAt)}
          </p>
        </div>

        <div
          className="taskflow-surface"
          style={{ marginTop: 12, padding: 16 }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
            提交正文
          </h3>
          <MarkdownContent content={submission.content || "_未填写正文_"} />

          {submission.attachments.length > 0 ? (
            <div style={{ marginTop: 16 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                附件
              </h4>
              <div style={{ display: "grid", gap: 8 }}>
                {submission.attachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    className="taskflow-surface"
                    href={getFileUrl(attachment.fileKey)}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      padding: "8px 10px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 12 }}>
                      {attachment.renamedFile || attachment.originalName}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--text-secondary)",
                        display: "inline-flex",
                        gap: 6,
                        alignItems: "center",
                      }}
                    >
                      {filesizeLabel(attachment.sizeBytes)}
                      <Download size={13} />
                    </span>
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div
          className="taskflow-surface"
          style={{ marginTop: 12, padding: 16 }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
            评分
          </h3>

          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <label className="taskflow-label" htmlFor="score">
                成绩
              </label>
              <input
                id="score"
                className="taskflow-input"
                type="number"
                step="0.1"
                value={score}
                onChange={(event) => setScore(event.target.value)}
                placeholder="例如 95.5"
              />
            </div>

            <div>
              <label className="taskflow-label" htmlFor="review-note">
                评语
              </label>
              <textarea
                id="review-note"
                className="taskflow-textarea"
                rows={4}
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              alignItems: "center",
              marginTop: 12,
            }}
          >
            <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {submission.reviewedAt
                ? `最近评分时间：${formatDateTime(submission.reviewedAt)}`
                : "尚未评分"}
            </p>

            <button
              type="button"
              className="taskflow-btn taskflow-btn-primary"
              disabled={saving}
              onClick={() => {
                void handleSaveGrade();
              }}
            >
              {saving ? "保存中..." : "保存评分"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
