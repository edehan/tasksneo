"use client";

import {
  BookOpen,
  ChevronRight,
  Home,
  Link as LinkIcon,
  LogOut,
  Menu,
  Moon,
  Notebook,
  Plus,
  Settings,
  Sun,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { CLASS_COLOR_PALETTE } from "@/features/designer/constants";
import { AppShellContextProvider } from "@/features/designer/context";
import {
  ApiError,
  createClass,
  joinClass,
  listClasses,
  listSchools,
  type School,
} from "@/lib/api";

interface BreadcrumbItem {
  href?: string;
  label: string;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function buildBreadcrumb(
  pathname: string,
  className?: string,
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [{ href: "/dashboard", label: "主页" }];

  if (pathname === "/dashboard") {
    items.push({ label: "全部任务" });
    return items;
  }

  if (pathname.startsWith("/settings/")) {
    items.push({ href: "/settings/profile", label: "设置" });
    if (pathname === "/settings/profile") items.push({ label: "个人资料" });
    if (pathname === "/settings/notifications")
      items.push({ label: "通知偏好" });
    if (pathname === "/settings/account") items.push({ label: "账号安全" });
    return items;
  }

  if (pathname.startsWith("/classes/")) {
    const classLabel = className ?? "班级";
    items.push({
      href: pathname.split("/").slice(0, 3).join("/"),
      label: classLabel,
    });

    if (pathname.endsWith("/settings")) items.push({ label: "班级设置" });
    if (pathname.endsWith("/members")) items.push({ label: "成员管理" });
    if (pathname.endsWith("/tasks/new")) items.push({ label: "发布任务" });
    if (pathname.includes("/edit")) items.push({ label: "编辑任务" });
    if (
      pathname.includes("/submission") &&
      !pathname.includes("/submissions")
    ) {
      items.push({ label: "我的提交" });
    }
    if (
      pathname.includes("/submissions/") &&
      !pathname.endsWith("/submissions")
    ) {
      items.push({
        href: pathname.split("/").slice(0, 7).join("/"),
        label: "提交列表",
      });
      items.push({ label: "提交详情" });
    } else if (pathname.endsWith("/submissions")) {
      items.push({ label: "提交列表" });
    }

    return items;
  }

  return items;
}

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      aria-modal="true"
      role="dialog"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <button
        type="button"
        aria-label="关闭弹窗"
        onClick={onClose}
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
        style={{ width: "100%", maxWidth: 440, padding: 24, zIndex: 1 }}
      >
        {children}
      </div>
    </div>
  );
}

export function DesignerAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { token, user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const [classes, setClasses] = useState<
    Awaited<ReturnType<typeof listClasses>>
  >([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const classIdFromPath = useMemo(() => {
    const matched = pathname.match(/^\/classes\/([^/]+)/);
    return matched?.[1] ?? null;
  }, [pathname]);

  const activeClass = useMemo(
    () =>
      classIdFromPath
        ? (classes.find((item) => item.id === classIdFromPath) ?? null)
        : null,
    [classIdFromPath, classes],
  );

  const classAccent = activeClass?.color ?? "#7B6CB0";

  const loadClasses = useCallback(async () => {
    if (!token) return;

    setLoadingClasses(true);
    try {
      const list = await listClasses(token);
      setClasses(list);
    } catch {
      setClasses([]);
    } finally {
      setLoadingClasses(false);
    }
  }, [token]);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 900;
      setIsMobile(mobile);
      if (!mobile) {
        setSidebarOpen(false);
      }
    };

    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const personalClass = classes.find((item) => item.isPersonal);
  const sharedClasses = classes.filter((item) => !item.isPersonal);
  const displayName = user?.nickname || user?.email || "User";

  const breadcrumbs = buildBreadcrumb(pathname, activeClass?.name);

  const contextValue = useMemo(
    () => ({
      classes,
      loadingClasses,
      refreshClasses: loadClasses,
      openJoinDialog: () => setJoinOpen(true),
      openCreateDialog: () => setCreateOpen(true),
    }),
    [classes, loadingClasses, loadClasses],
  );

  const sidebar = (
    <aside
      style={{
        width: 268,
        flexShrink: 0,
        borderRight: "1px solid var(--border-color)",
        background: "var(--sidebar-bg)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: 14,
          borderBottom: "1px solid var(--border-color)",
          position: "relative",
        }}
      >
        <button
          type="button"
          onClick={() => setUserMenuOpen((open) => !open)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            border: "none",
            background: userMenuOpen
              ? "color-mix(in srgb, var(--class-accent) 10%, transparent)"
              : "transparent",
            borderRadius: 10,
            padding: "10px",
            cursor: "pointer",
            color: "var(--text-primary)",
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background:
                "linear-gradient(135deg, var(--class-accent), color-mix(in srgb, var(--class-accent) 70%, black 30%))",
              color: "white",
              display: "grid",
              placeItems: "center",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            {getInitials(displayName)}
          </div>

          <div style={{ textAlign: "left", minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {displayName}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-secondary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user?.email}
            </div>
          </div>
        </button>

        {userMenuOpen ? (
          <div
            className="taskflow-surface"
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              left: 14,
              right: 14,
              zIndex: 20,
              padding: 6,
            }}
          >
            <button
              type="button"
              className="taskflow-btn"
              style={{
                width: "100%",
                justifyContent: "flex-start",
                display: "flex",
                gap: 8,
              }}
              onClick={() => {
                router.push("/settings/profile");
                setUserMenuOpen(false);
              }}
            >
              <Settings size={14} />
              设置
            </button>
            <button
              type="button"
              className="taskflow-btn"
              style={{
                width: "100%",
                justifyContent: "flex-start",
                display: "flex",
                gap: 8,
                marginTop: 6,
              }}
              onClick={() => {
                setTheme(theme === "dark" ? "light" : "dark");
                setUserMenuOpen(false);
              }}
            >
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              {theme === "dark" ? "浅色模式" : "深色模式"}
            </button>
            <button
              type="button"
              className="taskflow-btn taskflow-btn-danger"
              style={{
                width: "100%",
                justifyContent: "flex-start",
                display: "flex",
                gap: 8,
                marginTop: 6,
              }}
              onClick={() => {
                logout();
                router.replace("/login");
              }}
            >
              <LogOut size={14} />
              退出登录
            </button>
          </div>
        ) : null}
      </div>

      <nav style={{ flex: 1, overflowY: "auto", padding: "14px 10px" }}>
        <NavItem
          icon={<Home size={16} />}
          label="全部任务"
          href="/dashboard"
          active={pathname === "/dashboard"}
          onClick={() => {
            if (isMobile) {
              setSidebarOpen(false);
            }
          }}
        />

        {personalClass ? (
          <NavItem
            icon={<Notebook size={16} />}
            label="个人空间"
            href={`/classes/${personalClass.id}`}
            active={pathname.startsWith(`/classes/${personalClass.id}`)}
            color={personalClass.color}
            onClick={() => {
              if (isMobile) {
                setSidebarOpen(false);
              }
            }}
          />
        ) : null}

        <div
          style={{
            margin: "14px 10px",
            height: 1,
            background: "var(--border-color)",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 10px",
            marginBottom: 8,
            color: "var(--text-muted)",
            fontSize: 10,
            letterSpacing: "0.06em",
            fontWeight: 700,
          }}
        >
          <span>已加入班级</span>
          <button
            type="button"
            className="taskflow-btn"
            style={{ padding: 6 }}
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={14} />
          </button>
        </div>

        {loadingClasses ? (
          <div
            style={{
              padding: "8px 10px",
              color: "var(--text-secondary)",
              fontSize: 12,
            }}
          >
            加载中...
          </div>
        ) : null}

        {!loadingClasses && sharedClasses.length === 0 ? (
          <div
            style={{
              padding: "8px 10px",
              color: "var(--text-secondary)",
              fontSize: 12,
            }}
          >
            暂无班级
          </div>
        ) : null}

        {sharedClasses.map((item) => (
          <NavItem
            key={item.id}
            icon={<BookOpen size={16} />}
            label={item.name}
            href={`/classes/${item.id}`}
            active={pathname.startsWith(`/classes/${item.id}`)}
            color={item.color}
            onClick={() => {
              if (isMobile) {
                setSidebarOpen(false);
              }
            }}
          />
        ))}
      </nav>

      <div
        style={{
          borderTop: "1px solid var(--border-color)",
          padding: 12,
          display: "flex",
          gap: 8,
        }}
      >
        <button
          type="button"
          className="taskflow-btn taskflow-btn-primary"
          style={{
            flex: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
          onClick={() => setJoinOpen(true)}
        >
          <LinkIcon size={14} />
          加入班级
        </button>
        <button
          type="button"
          className="taskflow-btn"
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={14} />
          创建
        </button>
      </div>
    </aside>
  );

  return (
    <AppShellContextProvider value={contextValue}>
      <div
        style={{
          height: "100vh",
          width: "100vw",
          display: "flex",
          overflow: "hidden",
          background: "var(--bg)",
          color: "var(--text-primary)",
          ["--class-accent" as string]: classAccent,
        }}
      >
        {!isMobile ? sidebar : null}

        {isMobile && sidebarOpen ? (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 999,
            }}
          >
            <button
              type="button"
              aria-label="关闭侧边栏"
              onClick={() => setSidebarOpen(false)}
              style={{
                position: "absolute",
                inset: 0,
                border: "none",
                background: "rgba(0,0,0,0.4)",
                backdropFilter: "blur(3px)",
              }}
            />
            <div style={{ height: "100%", position: "relative", zIndex: 1 }}>
              {sidebar}
            </div>
          </div>
        ) : null}

        <main
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <header
            style={{
              height: 56,
              borderBottom: "1px solid var(--border-color)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0 16px",
              flexShrink: 0,
            }}
          >
            {isMobile ? (
              <button
                type="button"
                className="taskflow-btn"
                style={{ padding: 8 }}
                onClick={() => setSidebarOpen(true)}
                aria-label="open-menu"
              >
                <Menu size={16} />
              </button>
            ) : null}

            {breadcrumbs.map((item, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <div
                  key={`${item.label}-${idx}`}
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  {idx > 0 ? (
                    <ChevronRight size={13} color="var(--text-muted)" />
                  ) : null}
                  {item.href && !isLast ? (
                    <Link
                      href={item.href}
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        fontWeight: 500,
                      }}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span
                      style={{
                        fontSize: 12,
                        color: isLast
                          ? "var(--class-accent)"
                          : "var(--text-secondary)",
                        fontWeight: isLast ? 700 : 500,
                      }}
                    >
                      {item.label}
                    </span>
                  )}
                </div>
              );
            })}
          </header>

          <div style={{ flex: 1, overflow: "auto" }}>{children}</div>
        </main>

        {joinOpen ? (
          <JoinClassDialog
            token={token}
            onClose={() => setJoinOpen(false)}
            onJoined={async (classId) => {
              await loadClasses();
              setJoinOpen(false);
              router.push(`/classes/${classId}`);
            }}
          />
        ) : null}

        {createOpen ? (
          <CreateClassDialog
            token={token}
            onClose={() => setCreateOpen(false)}
            onCreated={async (classId) => {
              await loadClasses();
              setCreateOpen(false);
              router.push(`/classes/${classId}`);
            }}
          />
        ) : null}

        {isMobile && sidebarOpen ? (
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            style={{
              position: "fixed",
              zIndex: 1001,
              top: 10,
              left: 278,
              width: 34,
              height: 34,
              borderRadius: 8,
              border: "none",
              background: "var(--card-bg)",
              color: "var(--text-secondary)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <X size={16} />
          </button>
        ) : null}
      </div>
    </AppShellContextProvider>
  );
}

function NavItem({
  href,
  label,
  icon,
  active,
  color,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  color?: string;
  onClick?: () => void;
}) {
  const activeBg = color
    ? `color-mix(in srgb, ${color} 14%, transparent)`
    : "color-mix(in srgb, var(--class-accent) 12%, transparent)";
  const activeColor = color ?? "var(--class-accent)";

  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        padding: "9px 10px",
        borderRadius: 9,
        marginBottom: 2,
        textDecoration: "none",
        color: active ? activeColor : "var(--text-secondary)",
        background: active ? activeBg : "transparent",
        borderLeft: color
          ? `3px solid ${active ? color : "transparent"}`
          : undefined,
      }}
    >
      {icon}
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </Link>
  );
}

function JoinClassDialog({
  token,
  onClose,
  onJoined,
}: {
  token: string | null;
  onClose: () => void;
  onJoined: (classId: string) => Promise<void>;
}) {
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleJoin() {
    if (!token || !inviteCode.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const joined = await joinClass(token, inviteCode.trim());
      await onJoined(joined.id);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "INVITE_CODE_NOT_FOUND") {
          setError("邀请码无效或已失效");
        } else if (err.code === "SCHOOL_MISMATCH") {
          setError("该班级仅限指定学校的用户加入");
        } else if (err.code === "ALREADY_MEMBER") {
          setError("你已经是该班级的成员");
        } else {
          setError(err.message);
        }
      } else {
        setError("加入失败，请稍后重试");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h3 style={{ fontSize: 22, fontWeight: 700 }}>加入班级</h3>
      <p style={{ marginTop: 6, color: "var(--text-secondary)", fontSize: 13 }}>
        输入班级邀请码
      </p>

      <div style={{ marginTop: 18 }}>
        <input
          className="taskflow-input"
          placeholder="输入邀请码"
          value={inviteCode}
          onChange={(event) => setInviteCode(event.target.value)}
        />
        {error ? <p className="taskflow-error">{error}</p> : null}
      </div>

      <div
        style={{
          marginTop: 20,
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
        }}
      >
        <button type="button" className="taskflow-btn" onClick={onClose}>
          取消
        </button>
        <button
          type="button"
          className="taskflow-btn taskflow-btn-primary"
          onClick={handleJoin}
          disabled={submitting}
        >
          {submitting ? "加入中..." : "加入"}
        </button>
      </div>
    </Modal>
  );
}

function CreateClassDialog({
  token,
  onClose,
  onCreated,
}: {
  token: string | null;
  onClose: () => void;
  onCreated: (classId: string) => Promise<void>;
}) {
  const [schools, setSchools] = useState<School[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(CLASS_COLOR_PALETTE[0]);
  const [schoolId, setSchoolId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void listSchools()
      .then((res) => {
        if (active) setSchools(res);
      })
      .catch(() => {
        if (active) setSchools([]);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleCreate() {
    if (!token || !name.trim()) {
      setError("请输入班级名称");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const created = await createClass(token, {
        name: name.trim(),
        description: description.trim() || null,
        color,
        schoolId: schoolId || null,
      });
      await onCreated(created.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "创建失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h3 style={{ fontSize: 22, fontWeight: 700 }}>创建班级</h3>
      <p style={{ marginTop: 6, color: "var(--text-secondary)", fontSize: 13 }}>
        创建后你将成为所有者
      </p>

      <div style={{ marginTop: 18 }}>
        <label className="taskflow-label" htmlFor="create-class-name">
          班级名称
        </label>
        <input
          id="create-class-name"
          className="taskflow-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="例如：高级数学"
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <label className="taskflow-label" htmlFor="create-class-description">
          描述（选填）
        </label>
        <textarea
          id="create-class-description"
          className="taskflow-textarea"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="班级说明"
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <label className="taskflow-label" htmlFor="create-class-school">
          学校限制（选填）
        </label>
        <select
          id="create-class-school"
          className="taskflow-select"
          value={schoolId || "none"}
          onChange={(event) => {
            const value = event.target.value;
            setSchoolId(value === "none" ? "" : value);
          }}
        >
          <option value="none">不限制</option>
          {schools.map((school) => (
            <option key={school.id} value={school.id}>
              {school.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 12 }}>
        <p className="taskflow-label">颜色</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {CLASS_COLOR_PALETTE.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setColor(item)}
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                border:
                  color === item
                    ? "2px solid var(--text-primary)"
                    : "2px solid transparent",
                background: item,
                cursor: "pointer",
              }}
              aria-label={`color-${item}`}
            />
          ))}
        </div>
      </div>

      {error ? <p className="taskflow-error">{error}</p> : null}

      <div
        style={{
          marginTop: 20,
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
        }}
      >
        <button type="button" className="taskflow-btn" onClick={onClose}>
          取消
        </button>
        <button
          type="button"
          className="taskflow-btn taskflow-btn-primary"
          onClick={handleCreate}
          disabled={submitting}
        >
          {submitting ? "创建中..." : "创建班级"}
        </button>
      </div>
    </Modal>
  );
}
