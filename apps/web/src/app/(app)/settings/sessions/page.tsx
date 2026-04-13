"use client";

import {
  Bot,
  Globe,
  Laptop,
  Loader2,
  LogOut,
  Monitor,
  Smartphone,
  Tablet,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  listSessions,
  revokeOtherSessions,
  revokeSession,
  type SessionInfo,
} from "@/lib/api";

interface ParsedUserAgent {
  browser: string;
  os: string;
  deviceKind: "desktop" | "mobile" | "tablet" | "bot" | "unknown";
}

function parseUserAgent(ua: string | null): ParsedUserAgent {
  if (!ua) {
    return { browser: "Unknown", os: "Unknown", deviceKind: "unknown" };
  }

  // Bots first — some bots pretend to be browsers
  if (/bot|crawler|spider|curl|wget|python|node-fetch|axios/i.test(ua)) {
    return { browser: "Bot / Script", os: "—", deviceKind: "bot" };
  }

  // OS
  let os = "Unknown";
  if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Linux/i.test(ua)) os = "Linux";

  // Browser — order matters (Edge before Chrome, Chrome before Safari)
  let browser = "Unknown";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\//i.test(ua)) browser = "Opera";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Safari\//i.test(ua)) browser = "Safari";

  // Device kind
  let deviceKind: ParsedUserAgent["deviceKind"] = "desktop";
  if (/iPad|Tablet/i.test(ua)) deviceKind = "tablet";
  else if (/Mobile|iPhone|Android/i.test(ua)) {
    deviceKind =
      /Android/i.test(ua) && !/Mobile/i.test(ua) ? "tablet" : "mobile";
  }

  return { browser, os, deviceKind };
}

function DeviceIcon({ kind }: { kind: ParsedUserAgent["deviceKind"] | "mcp" }) {
  const className = "h-5 w-5 text-muted-foreground";
  switch (kind) {
    case "mcp":
      return <Bot className={className} />;
    case "mobile":
      return <Smartphone className={className} />;
    case "tablet":
      return <Tablet className={className} />;
    case "desktop":
      return <Laptop className={className} />;
    default:
      return <Monitor className={className} />;
  }
}

/**
 * Relative time per UX spec:
 *   just now (<1h, same calendar day)
 *   N hours ago (same calendar day)
 *   yesterday
 *   N days ago (2–7 days)
 *   absolute date (>7 days)
 */
function formatLastSeen(
  iso: string,
  t: ReturnType<typeof useTranslations>,
): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const dayDiff = Math.round(
    (startOfToday.getTime() - startOfDate.getTime()) / (24 * 3600 * 1000),
  );

  if (dayDiff <= 0) {
    if (diffMs < 60 * 60 * 1000) {
      return t("justNow");
    }

    return t("hoursAgo", {
      count: Math.max(1, Math.floor(diffMs / (60 * 60 * 1000))),
    });
  }
  if (dayDiff === 1) return t("yesterday");
  if (dayDiff <= 7) return t("daysAgo", { count: dayDiff });
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function SessionsPage() {
  const { user } = useAuth();
  const t = useTranslations("settingsSessions");

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const [revokeTarget, setRevokeTarget] = useState<SessionInfo | null>(null);
  const [revokeOthersOpen, setRevokeOthersOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadSessions = useCallback(async () => {
    if (!user) return;
    try {
      const result = await listSessions();
      setSessions(result);
    } catch {
      toast.error(t("failedLoad"));
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  async function handleRevoke() {
    if (!user || !revokeTarget) return;
    setBusy(true);
    try {
      await revokeSession(revokeTarget.id);
      setSessions((prev) => prev.filter((s) => s.id !== revokeTarget.id));
      toast.success(t("revoked"));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t("failedRevoke");
      toast.error(message);
    } finally {
      setBusy(false);
      setRevokeTarget(null);
    }
  }

  async function handleRevokeOthers() {
    if (!user) return;
    setBusy(true);
    try {
      await revokeOtherSessions();
      setSessions((prev) => prev.filter((s) => s.isCurrent));
      toast.success(t("revokedOthers"));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t("failedRevoke");
      toast.error(message);
    } finally {
      setBusy(false);
      setRevokeOthersOpen(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-48 bg-muted animate-pulse rounded" />
        <div className="h-16 bg-muted animate-pulse rounded" />
        <div className="h-16 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  const browserSessions = sessions.filter((s) => s.kind === "BROWSER");
  const mcpSessions = sessions.filter((s) => s.kind === "MCP");
  const hasOtherBrowserSessions = browserSessions.some((s) => !s.isCurrent);

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-heading-md">{t("title")}</h2>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
          </div>
          {hasOtherBrowserSessions && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setRevokeOthersOpen(true)}
            >
              <LogOut className="mr-1.5 h-4 w-4" />
              {t("signOutOthers")}
            </Button>
          )}
        </div>

        {browserSessions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">{t("noBrowsers")}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
            {browserSessions.map((s) => {
              const ua = parseUserAgent(s.userAgent);
              const deviceLabel =
                ua.browser === "Unknown" && ua.os === "Unknown"
                  ? t("unknownDevice")
                  : `${ua.browser} · ${ua.os}`;
              return (
                <div
                  key={s.id}
                  className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-surface-subtle transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="mt-0.5">
                      <DeviceIcon kind={ua.deviceKind} />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">
                          {deviceLabel}
                        </p>
                        {s.isCurrent && (
                          <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                            {t("current")}
                          </span>
                        )}
                        {s.isTrusted && (
                          <span className="rounded-full bg-class-accent/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-class-accent">
                            {t("trusted")}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        {s.ipAddress && (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            <span className="font-mono">{s.ipAddress}</span>
                          </span>
                        )}
                        <span>
                          {t("lastActive")} {formatLastSeen(s.lastSeenAt, t)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {!s.isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => setRevokeTarget(s)}
                    >
                      {t("signOut")}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {mcpSessions.length > 0 && (
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-heading-md">{t("mcpTitle")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("mcpDescription")}
            </p>
          </div>
          <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
            {mcpSessions.map((s) => (
              <div
                key={s.id}
                className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-surface-subtle transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="mt-0.5">
                    <DeviceIcon kind="mcp" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-medium truncate">
                      {s.mcpKeyName ?? t("unknownMcpKey")}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {s.ipAddress && (
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          <span className="font-mono">{s.ipAddress}</span>
                        </span>
                      )}
                      <span>
                        {t("lastActive")} {formatLastSeen(s.lastSeenAt, t)}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => setRevokeTarget(s)}
                >
                  {t("signOut")}
                </Button>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t("mcpHint")}</p>
        </section>
      )}

      {/* Revoke single session */}
      <AlertDialog
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("revokeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget?.kind === "MCP"
                ? t("revokeMcpDescription", {
                    name: revokeTarget?.mcpKeyName ?? t("unknownMcpKey"),
                  })
                : t("revokeBrowserDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("signOut")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke all others */}
      <AlertDialog
        open={revokeOthersOpen}
        onOpenChange={(open) => !open && setRevokeOthersOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("signOutOthersTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("signOutOthersDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeOthers}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("signOutOthers")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
