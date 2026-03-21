"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { getNotificationPrefs, upsertNotificationPref } from "@/lib/api";

export default function NotificationSettingsPage() {
  const { token, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [emailAddress, setEmailAddress] = useState("");

  useEffect(() => {
    if (!token) return;

    let active = true;

    void getNotificationPrefs(token)
      .then((prefs) => {
        if (!active) return;

        const emailPref = prefs.find((item) => item.channel === "EMAIL");
        setEmailEnabled(emailPref?.isEnabled ?? true);
        setEmailAddress(emailPref?.address || user?.email || "");
      })
      .catch(() => {
        if (active) {
          setEmailAddress(user?.email || "");
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
  }, [token, user]);

  async function handleSave() {
    if (!token || !emailAddress.trim()) {
      toast.error("请填写通知邮箱");
      return;
    }

    setSaving(true);
    try {
      await upsertNotificationPref(token, {
        channel: "EMAIL",
        address: emailAddress.trim(),
        isEnabled: emailEnabled,
      });
      toast.success("通知偏好已保存");
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
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
          通知偏好
        </h1>

        <div
          className="taskflow-surface"
          style={{ marginTop: 12, padding: 16 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>电子邮件通知</h3>
              <p
                style={{
                  marginTop: 4,
                  color: "var(--text-secondary)",
                  fontSize: 12,
                }}
              >
                新任务发布和截止提醒会发送到指定邮箱
              </p>
            </div>

            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={emailEnabled}
                onChange={(event) => setEmailEnabled(event.target.checked)}
              />
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {emailEnabled ? "开启" : "关闭"}
              </span>
            </label>
          </div>

          <div style={{ marginTop: 12 }}>
            <label className="taskflow-label" htmlFor="email-address">
              邮件地址
            </label>
            <input
              id="email-address"
              className="taskflow-input"
              value={emailAddress}
              onChange={(event) => setEmailAddress(event.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div
            style={{ marginTop: 12, color: "var(--text-muted)", fontSize: 12 }}
          >
            其他渠道（Webhook、Telegram）将于后续版本开放。
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 14,
            }}
          >
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
