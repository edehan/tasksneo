"use client";

import { Copy, RefreshCcw, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import {
  CLASS_COLOR_PALETTE,
  roleCanManageClass,
} from "@/features/designer/constants";
import { useAppShell } from "@/features/designer/context";
import {
  type ClassSummary,
  deleteClass,
  getClass,
  listSchools,
  refreshInviteCode,
  type School,
  updateClass,
} from "@/lib/api";

export default function ClassSettingsPage() {
  const params = useParams<{ classId: string }>();
  const classId = params.classId;

  const router = useRouter();
  const { token } = useAuth();
  const { classes, refreshClasses } = useAppShell();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyRefreshCode, setBusyRefreshCode] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);

  const [schools, setSchools] = useState<School[]>([]);
  const [classInfo, setClassInfo] = useState<ClassSummary | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(CLASS_COLOR_PALETTE[0]);

  const currentClass = classes.find((item) => item.id === classId) ?? null;
  const canManage = currentClass
    ? roleCanManageClass(currentClass.myRole)
    : false;

  useEffect(() => {
    if (!token || !canManage) return;

    let active = true;
    setLoading(true);

    void Promise.all([getClass(token, classId), listSchools()])
      .then(([classRes, schoolsRes]) => {
        if (!active) return;

        setClassInfo(classRes);
        setName(classRes.name);
        setDescription(classRes.description || "");
        setColor(classRes.color);
        setSchools(schoolsRes);
      })
      .catch(() => {
        if (active) {
          toast.error("加载班级设置失败");
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
  }, [token, classId, canManage]);

  async function handleSave() {
    if (!token || !classInfo || !name.trim()) return;

    setSaving(true);
    try {
      const updated = await updateClass(token, classInfo.id, {
        name: name.trim(),
        description: description.trim() || null,
        color,
      });
      setClassInfo(updated);
      await refreshClasses();
      toast.success("班级设置已保存");
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleRefreshCode() {
    if (!token || !classInfo) return;

    const confirm = window.confirm("刷新后旧邀请码立即失效，是否继续？");
    if (!confirm) return;

    setBusyRefreshCode(true);
    try {
      const next = await refreshInviteCode(token, classInfo.id);
      setClassInfo((prev) =>
        prev
          ? {
              ...prev,
              inviteCode: next.inviteCode,
            }
          : prev,
      );
      await refreshClasses();
      toast.success("邀请码已刷新");
    } catch {
      toast.error("刷新邀请码失败");
    } finally {
      setBusyRefreshCode(false);
    }
  }

  async function handleDeleteClass() {
    if (!token || !classInfo) return;

    const confirmed = window.confirm("确认删除班级？此操作不可撤销。");
    if (!confirmed) return;

    setBusyDelete(true);
    try {
      await deleteClass(token, classInfo.id);
      await refreshClasses();
      router.replace("/dashboard");
    } catch {
      toast.error("删除班级失败");
    } finally {
      setBusyDelete(false);
    }
  }

  if (!canManage) {
    return (
      <div style={{ padding: "24px 32px", color: "#c45c5c" }}>
        你没有班级设置权限
      </div>
    );
  }

  if (loading || !classInfo) {
    return (
      <div style={{ padding: "24px 32px", color: "var(--text-secondary)" }}>
        加载班级设置中...
      </div>
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
      <div style={{ width: "100%", maxWidth: 760 }}>
        <h1 style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.1 }}>
          班级设置
        </h1>

        <div
          className="taskflow-surface"
          style={{ marginTop: 12, padding: 16 }}
        >
          <div style={{ marginBottom: 12 }}>
            <label className="taskflow-label" htmlFor="class-name">
              班级名称
            </label>
            <input
              id="class-name"
              className="taskflow-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label className="taskflow-label" htmlFor="class-description">
              班级描述
            </label>
            <textarea
              id="class-description"
              className="taskflow-textarea"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <p className="taskflow-label">颜色</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {CLASS_COLOR_PALETTE.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setColor(item)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    border:
                      color === item
                        ? "2px solid var(--text-primary)"
                        : "2px solid transparent",
                    background: item,
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label className="taskflow-label" htmlFor="school-limit">
              学校限制（v1 当前仅展示）
            </label>
            <select
              id="school-limit"
              className="taskflow-select"
              disabled
              value={classInfo.schoolId || "none"}
            >
              <option value="none">不限制</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="taskflow-btn taskflow-btn-primary"
              disabled={saving || !name.trim()}
              onClick={() => {
                void handleSave();
              }}
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>

        <div
          className="taskflow-surface"
          style={{ marginTop: 12, padding: 16 }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>
            邀请码
          </h3>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <code
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                padding: "7px 10px",
                borderRadius: 8,
                background:
                  "color-mix(in srgb, var(--class-accent) 10%, transparent)",
              }}
            >
              {classInfo.inviteCode || "无邀请码"}
            </code>

            <button
              type="button"
              className="taskflow-btn"
              disabled={!classInfo.inviteCode}
              onClick={() => {
                if (!classInfo.inviteCode) return;
                void navigator.clipboard.writeText(classInfo.inviteCode);
                toast.success("邀请码已复制");
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Copy size={14} />
              复制
            </button>

            <button
              type="button"
              className="taskflow-btn"
              disabled={busyRefreshCode || classInfo.isPersonal}
              onClick={() => {
                void handleRefreshCode();
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <RefreshCcw size={14} />
              {busyRefreshCode ? "刷新中..." : "刷新邀请码"}
            </button>
          </div>
        </div>

        <div
          className="taskflow-surface"
          style={{
            marginTop: 12,
            borderColor: "color-mix(in srgb, #c45c5c 40%, var(--border-color))",
            padding: 16,
          }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#c45c5c" }}>
            危险区
          </h3>
          <p
            style={{
              marginTop: 6,
              color: "var(--text-secondary)",
              fontSize: 12,
            }}
          >
            删除班级后，相关任务会被清理，操作不可撤销。
          </p>
          <button
            type="button"
            className="taskflow-btn taskflow-btn-danger"
            disabled={busyDelete}
            onClick={() => {
              void handleDeleteClass();
            }}
            style={{
              marginTop: 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Trash2 size={14} />
            {busyDelete ? "删除中..." : "删除班级"}
          </button>
        </div>
      </div>
    </div>
  );
}
