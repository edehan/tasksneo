"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { useAppShell } from "@/features/designer/context";
import { deleteAccount } from "@/lib/api";

export default function AccountSettingsPage() {
  const router = useRouter();
  const { token, user, logout } = useAuth();
  const { classes } = useAppShell();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [busyDelete, setBusyDelete] = useState(false);

  const ownerClasses = useMemo(
    () => classes.filter((item) => !item.isPersonal && item.myRole === "OWNER"),
    [classes],
  );

  async function handleDelete() {
    if (!token || !user) return;
    if (confirmEmail.trim() !== user.email) {
      toast.error("请输入正确的邮箱地址以确认删除");
      return;
    }

    setBusyDelete(true);
    try {
      await deleteAccount(token);
      logout();
      router.replace("/login");
      toast.success("账号已删除");
    } catch {
      toast.error("删除账号失败");
    } finally {
      setBusyDelete(false);
    }
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
          账号安全
        </h1>

        <div
          className="taskflow-surface"
          style={{
            marginTop: 12,
            padding: 16,
            borderColor: "color-mix(in srgb, #c45c5c 40%, var(--border-color))",
          }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#c45c5c" }}>
            删除账号
          </h3>
          <p
            style={{
              marginTop: 6,
              color: "var(--text-secondary)",
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            删除账号将删除你的所有提交数据和个人空间。此操作不可撤销。
          </p>

          <button
            type="button"
            className="taskflow-btn taskflow-btn-danger"
            style={{ marginTop: 12 }}
            onClick={() => setDialogOpen(true)}
          >
            删除账号
          </button>
        </div>

        {dialogOpen ? (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <button
              type="button"
              aria-label="关闭删除账号弹窗"
              onClick={() => setDialogOpen(false)}
              style={{
                position: "absolute",
                inset: 0,
                border: "none",
                background: "rgba(0,0,0,0.4)",
                backdropFilter: "blur(4px)",
              }}
            />
            <div
              className="taskflow-surface"
              style={{ width: "100%", maxWidth: 480, padding: 20, zIndex: 1 }}
            >
              <h3 style={{ fontSize: 20, fontWeight: 700 }}>删除账号</h3>

              {ownerClasses.length > 0 ? (
                <>
                  <p
                    style={{
                      marginTop: 10,
                      color: "var(--text-secondary)",
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    你仍是以下班级的所有者。请先转让所有权后再删除账号。
                  </p>
                  <ul
                    style={{
                      marginTop: 8,
                      paddingLeft: 18,
                      color: "var(--text-secondary)",
                      fontSize: 13,
                    }}
                  >
                    {ownerClasses.map((item) => (
                      <li key={item.id}>{item.name}</li>
                    ))}
                  </ul>
                  <div
                    style={{
                      marginTop: 14,
                      display: "flex",
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
                      type="button"
                      className="taskflow-btn"
                      onClick={() => setDialogOpen(false)}
                    >
                      知道了
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p
                    style={{
                      marginTop: 10,
                      color: "var(--text-secondary)",
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    输入你的邮箱地址进行最终确认：
                  </p>

                  <input
                    className="taskflow-input"
                    value={confirmEmail}
                    onChange={(event) => setConfirmEmail(event.target.value)}
                    placeholder={user?.email || "邮箱"}
                    style={{ marginTop: 10 }}
                  />

                  <div
                    style={{
                      marginTop: 14,
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: 8,
                    }}
                  >
                    <button
                      type="button"
                      className="taskflow-btn"
                      onClick={() => setDialogOpen(false)}
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      className="taskflow-btn taskflow-btn-danger"
                      disabled={busyDelete}
                      onClick={() => {
                        void handleDelete();
                      }}
                    >
                      {busyDelete ? "删除中..." : "确认删除"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
