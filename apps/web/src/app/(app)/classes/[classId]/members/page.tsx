"use client";

import { Crown, Shield, UserRound, UserX } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { roleLabel } from "@/features/designer/constants";
import { useAppShell } from "@/features/designer/context";
import { formatDateTime } from "@/features/designer/format";
import {
  type ClassMember,
  listMembers,
  removeMember,
  transferOwnership,
  updateMemberRole,
} from "@/lib/api";

export default function ClassMembersPage() {
  const params = useParams<{ classId: string }>();
  const classId = params.classId;

  const { token, user } = useAuth();
  const { classes, refreshClasses } = useAppShell();

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [transferTargetId, setTransferTargetId] = useState("");
  const [busy, setBusy] = useState(false);

  const targetClass = classes.find((item) => item.id === classId) ?? null;
  const myRole = targetClass?.myRole;
  const me = user?.id || "";

  const transferableMembers = useMemo(
    () => members.filter((item) => item.userId !== me),
    [members, me],
  );

  useEffect(() => {
    if (!token) return;

    let active = true;
    setLoading(true);

    void listMembers(token, classId)
      .then((res) => {
        if (active) {
          setMembers(res);
          if (!transferTargetId && res.length > 1) {
            const first = res.find((item) => item.userId !== me);
            if (first) {
              setTransferTargetId(first.userId);
            }
          }
        }
      })
      .catch(() => {
        if (active) {
          toast.error("加载成员失败");
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
  }, [token, classId, me, transferTargetId]);

  async function refreshMembers() {
    if (!token) return;
    const list = await listMembers(token, classId);
    setMembers(list);
  }

  async function handleRoleChange(userId: string, role: "ADMIN" | "MEMBER") {
    if (!token) return;
    setBusy(true);
    try {
      await updateMemberRole(token, classId, userId, role);
      await refreshMembers();
      await refreshClasses();
      toast.success("角色已更新");
    } catch {
      toast.error("操作失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(userId: string) {
    if (!token) return;
    const confirmed = window.confirm("确认移除该成员？");
    if (!confirmed) return;

    setBusy(true);
    try {
      await removeMember(token, classId, userId);
      await refreshMembers();
      await refreshClasses();
      toast.success("成员已移除");
    } catch {
      toast.error("移除失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleTransferOwnership() {
    if (!token || !transferTargetId) return;

    const confirmed = window.confirm("转让后你将成为 ADMIN，是否继续？");
    if (!confirmed) return;

    setBusy(true);
    try {
      await transferOwnership(token, classId, transferTargetId);
      await refreshMembers();
      await refreshClasses();
      toast.success("所有权已转让");
    } catch {
      toast.error("转让失败");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "24px 32px", color: "var(--text-secondary)" }}>
        加载成员中...
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 28px 40px" }}>
      <div style={{ maxWidth: 980 }}>
        <h1 style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.1 }}>
          成员管理
        </h1>

        {myRole === "OWNER" ? (
          <div
            className="taskflow-surface"
            style={{ marginTop: 12, padding: 14 }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>转让所有权</h3>
            <p
              style={{
                marginTop: 4,
                color: "var(--text-secondary)",
                fontSize: 12,
              }}
            >
              选择一个成员转让班级所有权。你将降级为管理员。
            </p>
            <div
              style={{
                marginTop: 8,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <select
                className="taskflow-select"
                value={transferTargetId || ""}
                onChange={(event) => setTransferTargetId(event.target.value)}
                style={{ maxWidth: 320 }}
              >
                {transferableMembers.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.nickname || member.email}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="taskflow-btn"
                disabled={!transferTargetId || busy}
                onClick={() => {
                  void handleTransferOwnership();
                }}
              >
                转让所有权
              </button>
            </div>
          </div>
        ) : null}

        <div
          className="taskflow-surface"
          style={{ marginTop: 12, overflow: "hidden" }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  background:
                    "color-mix(in srgb, var(--class-accent) 7%, transparent)",
                }}
              >
                {["成员", "角色", "加入时间", "操作"].map((item) => (
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
              {members.map((member) => {
                const isMe = member.userId === me;
                const role = member.role;
                const canOwnerOperate = myRole === "OWNER" && !isMe;
                const canAdminOperate =
                  myRole === "ADMIN" && role === "MEMBER" && !isMe;
                const canOperate = canOwnerOperate || canAdminOperate;

                return (
                  <tr
                    key={member.userId}
                    style={{ borderBottom: "1px solid var(--border-color)" }}
                  >
                    <td style={{ padding: "9px 10px" }}>
                      <div style={{ fontSize: 13 }}>
                        {member.nickname || member.email}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-secondary)",
                          marginTop: 2,
                        }}
                      >
                        {member.email}
                      </div>
                    </td>
                    <td style={{ padding: "9px 10px" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          borderRadius: 6,
                          padding: "3px 8px",
                          color:
                            role === "OWNER"
                              ? "#C4785B"
                              : role === "ADMIN"
                                ? "#5886A5"
                                : "var(--text-secondary)",
                          background:
                            role === "OWNER"
                              ? "color-mix(in srgb, #C4785B 14%, transparent)"
                              : role === "ADMIN"
                                ? "color-mix(in srgb, #5886A5 14%, transparent)"
                                : "color-mix(in srgb, var(--text-secondary) 10%, transparent)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {role === "OWNER" ? (
                          <Crown size={12} />
                        ) : role === "ADMIN" ? (
                          <Shield size={12} />
                        ) : (
                          <UserRound size={12} />
                        )}
                        {roleLabel(role)}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "9px 10px",
                        fontSize: 12,
                        color: "var(--text-secondary)",
                      }}
                    >
                      {formatDateTime(member.joinedAt)}
                    </td>
                    <td style={{ padding: "9px 10px" }}>
                      <div
                        style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                      >
                        {myRole === "OWNER" && role === "MEMBER" && !isMe ? (
                          <button
                            type="button"
                            className="taskflow-btn"
                            disabled={busy}
                            onClick={() => {
                              void handleRoleChange(member.userId, "ADMIN");
                            }}
                          >
                            设为管理员
                          </button>
                        ) : null}

                        {myRole === "OWNER" && role === "ADMIN" && !isMe ? (
                          <button
                            type="button"
                            className="taskflow-btn"
                            disabled={busy}
                            onClick={() => {
                              void handleRoleChange(member.userId, "MEMBER");
                            }}
                          >
                            降为成员
                          </button>
                        ) : null}

                        {canOperate ? (
                          <button
                            type="button"
                            className="taskflow-btn taskflow-btn-danger"
                            disabled={busy}
                            onClick={() => {
                              void handleRemove(member.userId);
                            }}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <UserX size={13} />
                            移除
                          </button>
                        ) : null}

                        {isMe ? (
                          <button
                            type="button"
                            className="taskflow-btn taskflow-btn-danger"
                            disabled={busy || role === "OWNER"}
                            title={
                              role === "OWNER"
                                ? "转让所有权后方可退出"
                                : "退出班级"
                            }
                            onClick={() => {
                              void handleRemove(member.userId);
                            }}
                          >
                            退出班级
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
