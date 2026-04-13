"use client";

import {
  Bot,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  Terminal,
  Trash2,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ApiError,
  createMcpKey,
  listMcpKeys,
  type McpKeyCreated,
  type McpKeyInfo,
  revokeMcpKey,
} from "@/lib/api";

function formatRelativeTime(
  iso: string,
  t: ReturnType<typeof useTranslations>,
): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t("justNow");
  if (minutes < 60) return t("minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  return t("daysAgo", { count: days });
}

function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
}

function getClaudeCodeCommand(key: string): string {
  const apiUrl = getApiUrl();
  const mcpPkgUrl = `${apiUrl}/mcp/taskflow-mcp-latest.tgz`;
  return [
    "claude mcp add taskflow \\",
    `  -e TASKFLOW_API_URL=${apiUrl} \\`,
    `  -e TASKFLOW_MCP_KEY=${key} \\`,
    `  -- npx -y ${mcpPkgUrl}`,
  ].join("\n");
}

function getOpenClawCommand(key: string): string {
  const apiUrl = getApiUrl();
  const mcpPkgUrl = `${apiUrl}/mcp/taskflow-mcp-latest.tgz`;
  const config = {
    command: "npx",
    args: ["-y", mcpPkgUrl],
    env: {
      TASKFLOW_API_URL: apiUrl,
      TASKFLOW_MCP_KEY: key,
    },
  };
  return `openclaw mcp set taskflow '${JSON.stringify(config)}'`;
}

interface GuideCardProps {
  icon: React.ReactNode;
  name: string;
  tagline: string;
  command: string;
  copyLabel: string;
}

function GuideCard({
  icon,
  name,
  tagline,
  command,
  copyLabel,
}: GuideCardProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-foreground">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold leading-tight">{name}</h3>
          <p className="text-xs text-muted-foreground mt-1">{tagline}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 shrink-0"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          <span className="ml-1.5 text-xs">{copyLabel}</span>
        </Button>
      </div>
      <pre className="rounded-lg border border-border bg-surface-subtle/60 p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all text-foreground leading-relaxed">
        {command}
      </pre>
    </div>
  );
}

export default function McpKeysPage() {
  const { user } = useAuth();
  const t = useTranslations("settingsMcpKeys");

  const [keys, setKeys] = useState<McpKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<McpKeyCreated | null>(null);
  const [copied, setCopied] = useState(false);

  // Revoke dialog
  const [revokeTarget, setRevokeTarget] = useState<McpKeyInfo | null>(null);
  const [revoking, setRevoking] = useState(false);

  const loadKeys = useCallback(async () => {
    if (!user) return;
    try {
      const result = await listMcpKeys();
      setKeys(result);
    } catch {
      toast.error(t("failedLoad"));
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  async function handleCreate() {
    if (!user || !keyName.trim()) return;
    setCreating(true);
    try {
      const result = await createMcpKey(keyName.trim());
      setCreatedKey(result);
      setKeys((prev) => [result, ...prev]);
      setKeyName("");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t("failedCreate");
      toast.error(message);
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke() {
    if (!user || !revokeTarget) return;
    setRevoking(true);
    try {
      await revokeMcpKey(revokeTarget.id);
      setKeys((prev) =>
        prev.map((k) =>
          k.id === revokeTarget.id
            ? { ...k, revokedAt: new Date().toISOString() }
            : k,
        ),
      );
      toast.success(t("revoked"));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t("failedRevoke");
      toast.error(message);
    } finally {
      setRevoking(false);
      setRevokeTarget(null);
    }
  }

  function handleCopyKey() {
    if (!createdKey) return;
    navigator.clipboard.writeText(createdKey.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCloseCreate() {
    setCreateOpen(false);
    setCreatedKey(null);
    setKeyName("");
    setCopied(false);
  }

  const activeKeys = keys.filter((k) => !k.revokedAt);
  const revokedKeys = keys.filter((k) => k.revokedAt);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-48 bg-muted animate-pulse rounded" />
        <div className="h-10 bg-muted animate-pulse rounded" />
        <div className="h-10 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* === TOP ZONE: Key management (compact) === */}
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-heading-md">{t("title")}</h2>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            size="sm"
            className="shrink-0"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {t("createNew")}
          </Button>
        </div>

        {activeKeys.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">{t("noKeys")}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
            {activeKeys.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-subtle transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex items-baseline gap-3">
                    <p className="text-sm font-medium truncate">{k.name}</p>
                    <p className="text-xs text-muted-foreground font-mono shrink-0">
                      {k.keyPrefix}…
                    </p>
                    <p className="text-xs text-muted-foreground truncate hidden sm:block">
                      {k.lastUsedAt
                        ? `${t("lastUsed")} ${formatRelativeTime(k.lastUsedAt, t)}`
                        : `${t("created")} ${formatRelativeTime(k.createdAt, t)}`}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => setRevokeTarget(k)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {revokedKeys.length > 0 && (
          <details className="group">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
              {t("revokedKeys")} ({revokedKeys.length})
            </summary>
            <div className="mt-2 space-y-1">
              {revokedKeys.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center gap-3 px-4 py-2 text-xs text-muted-foreground"
                >
                  <KeyRound className="h-3 w-3 shrink-0" />
                  <span className="line-through truncate">{k.name}</span>
                  <span className="font-mono shrink-0">{k.keyPrefix}…</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      {/* Create dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => !open && handleCloseCreate()}
      >
        <DialogContent
          className={`max-h-[88vh] overflow-y-auto overflow-x-hidden ${createdKey ? "sm:max-w-3xl" : "sm:max-w-lg"}`}
        >
          <DialogHeader>
            <DialogTitle>
              {createdKey ? t("keyCreated") : t("createNew")}
            </DialogTitle>
            <DialogDescription>
              {createdKey ? t("keyCreatedHint") : t("createDescription")}
            </DialogDescription>
          </DialogHeader>

          {!createdKey ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="key-name">{t("keyName")}</Label>
                <Input
                  id="key-name"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder={t("keyNamePlaceholder")}
                  disabled={creating}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
              </div>
              <DialogFooter>
                <Button
                  onClick={handleCreate}
                  disabled={creating || !keyName.trim()}
                >
                  {creating && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("create")}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="space-y-5">
              <div className="rounded-xl border border-border bg-surface-subtle/40 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label>{t("secretKey")}</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0"
                    onClick={handleCopyKey}
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    <span className="ml-1.5 text-xs">{t("copy")}</span>
                  </Button>
                </div>
                <p className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs break-all">
                  {createdKey.key}
                </p>
                <p className="text-xs text-destructive font-medium">
                  {t("keyWontShowAgain")}
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-medium">
                  {t("installCommandsHeading")}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t("installCommandsHint")}
                </p>
              </div>

              <div className="space-y-4">
                <GuideCard
                  icon={<Terminal className="h-5 w-5" />}
                  name={t("claudeCode.name")}
                  tagline={t("claudeCode.tagline")}
                  command={getClaudeCodeCommand(createdKey.key)}
                  copyLabel={t("copy")}
                />
                <GuideCard
                  icon={<Bot className="h-5 w-5" />}
                  name={t("openClaw.name")}
                  tagline={t("openClaw.tagline")}
                  command={getOpenClawCommand(createdKey.key)}
                  copyLabel={t("copy")}
                />
              </div>

              <DialogFooter>
                <Button onClick={handleCloseCreate}>{t("done")}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation */}
      <AlertDialog
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("revokeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("revokeDescription", { name: revokeTarget?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={revoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revoking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("revoke")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
