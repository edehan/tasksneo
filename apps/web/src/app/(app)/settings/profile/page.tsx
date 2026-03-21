"use client";

import { Camera } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import {
  listSchools,
  type School,
  updateProfile,
  uploadAvatar,
} from "@/lib/api";

export default function ProfileSettingsPage() {
  const { token, user, updateUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [schools, setSchools] = useState<School[]>([]);
  const [nickname, setNickname] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [studentId, setStudentId] = useState("");

  const studentRequired = Boolean(schoolId);

  useEffect(() => {
    if (!user) return;

    setNickname(user.nickname || "");
    setSchoolId(user.schoolId || "");
    setStudentId(user.studentId || "");
  }, [user]);

  useEffect(() => {
    let active = true;

    void listSchools()
      .then((res) => {
        if (active) {
          setSchools(res);
        }
      })
      .catch(() => {
        if (active) {
          setSchools([]);
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
  }, []);

  const avatarLabel = useMemo(() => {
    const source = user?.nickname || user?.email || "U";
    const words = source.split(/\s+/).filter(Boolean);
    if (words.length === 0) return "U";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
  }, [user]);

  async function handleSave() {
    if (!token) return;

    if (studentRequired && !studentId.trim()) {
      toast.error("选择学校后，学号必填");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateProfile(token, {
        nickname: nickname.trim() || null,
        schoolId: schoolId || null,
        studentId: schoolId ? studentId.trim() || null : null,
      });
      updateUser(updated);
      toast.success("个人资料已保存");
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarUpload(files: FileList | null) {
    if (!token || !files || files.length === 0) return;

    setUploadingAvatar(true);
    try {
      await uploadAvatar(token, files[0]);
      toast.success("头像已上传");
    } catch {
      toast.error("头像上传失败");
    } finally {
      setUploadingAvatar(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "24px 32px", color: "var(--text-secondary)" }}>
        加载中...
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
      <div style={{ width: "100%", maxWidth: 640 }}>
        <h1 style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.1 }}>
          个人资料
        </h1>

        <div
          className="taskflow-surface"
          style={{ marginTop: 12, padding: 16 }}
        >
          <div
            style={{
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <label
              style={{
                width: 66,
                height: 66,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                background:
                  "color-mix(in srgb, var(--class-accent) 20%, transparent)",
                color: "var(--class-accent)",
                fontSize: 20,
                fontWeight: 700,
                cursor: uploadingAvatar ? "wait" : "pointer",
              }}
            >
              {avatarLabel}
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                disabled={uploadingAvatar}
                onChange={(event) => {
                  void handleAvatarUpload(event.target.files);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>头像</div>
              <label
                className="taskflow-btn"
                style={{
                  marginTop: 6,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Camera size={14} />
                {uploadingAvatar ? "上传中..." : "更换头像"}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  disabled={uploadingAvatar}
                  onChange={(event) => {
                    void handleAvatarUpload(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label className="taskflow-label" htmlFor="nickname">
              昵称
            </label>
            <input
              id="nickname"
              className="taskflow-input"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label className="taskflow-label" htmlFor="email">
              邮箱
            </label>
            <input
              id="email"
              className="taskflow-input"
              value={user?.email || ""}
              disabled
              style={{ opacity: 0.7 }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label className="taskflow-label" htmlFor="school-id">
              学校
            </label>
            <select
              id="school-id"
              className="taskflow-select"
              value={schoolId || "none"}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "none") {
                  setSchoolId("");
                  setStudentId("");
                } else {
                  setSchoolId(value);
                }
              }}
            >
              <option value="none">不填写</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </div>

          {studentRequired ? (
            <div style={{ marginBottom: 12 }}>
              <label className="taskflow-label" htmlFor="student-id">
                学号 <span style={{ color: "#c45c5c" }}>*</span>
              </label>
              <input
                id="student-id"
                className="taskflow-input"
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
              />
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="taskflow-btn taskflow-btn-primary"
              disabled={saving}
              onClick={() => {
                void handleSave();
              }}
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
