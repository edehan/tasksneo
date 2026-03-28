"use client";

import { Check, Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
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

export default function McpKeysPage() {
  const { token } = useAuth();
  const t = useTranslations("settingsMcpKeys");

  const [keys, setKeys] = useState<McpKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<McpKeyCreated | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Revoke dialog
  const [revokeTarget, setRevokeTarget] = useState<McpKeyInfo | null>(null);
  const [revoking, setRevoking] = useState(false);

  const loadKeys = useCallback(async () => {
    if (!token) return;
    try {
      const result = await listMcpKeys(token);
      setKeys(result);
    } catch {
      toast.error(t("failedLoad"));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  async function handleCreate() {
    if (!token || !keyName.trim()) return;
    setCreating(true);
    try {
      const result = await createMcpKey(token, keyName.trim());
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
    if (!token || !revokeTarget) return;
    setRevoking(true);
    try {
      await revokeMcpKey(token, revokeTarget.id);
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

  function getConfigSnippet(): string {
    if (!createdKey) return "";
    const apiUrl =
      process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
    const mcpPkgUrl = `${apiUrl}/mcp/taskflow-mcp-latest.tgz`;
    return [
      "claude mcp add taskflow \\",
      `  -e TASKFLOW_API_URL=${apiUrl} \\`,
      `  -e TASKFLOW_MCP_KEY=${createdKey.key} \\`,
      `  -- npx -y ${mcpPkgUrl}`,
    ].join("\n");
  }

  function handleCopySnippet() {
    navigator.clipboard.writeText(getConfigSnippet());
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  }

  function handleCloseCreate() {
    setCreateOpen(false);
    setCreatedKey(null);
    setKeyName("");
    setCopied(false);
    setCopiedSnippet(false);
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
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-heading-md">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          {t("createNew")}
        </Button>
      </section>

      {/* Active keys */}
      {activeKeys.length > 0 && (
        <section className="space-y-3">
          {activeKeys.map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between rounded-lg border border-border p-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{k.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {k.keyPrefix}
                    {"..."}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("created")} {formatRelativeTime(k.createdAt, t)}
                    {k.lastUsedAt && (
                      <>
                        {" · "}
                        {t("lastUsed")} {formatRelativeTime(k.lastUsedAt, t)}
                      </>
                    )}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive shrink-0"
                onClick={() => setRevokeTarget(k)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </section>
      )}

      {activeKeys.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("noKeys")}</p>
      )}

      {/* Revoked keys */}
      {revokedKeys.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            {t("revokedKeys")}
          </h3>
          {revokedKeys.map((k) => (
            <div
              key={k.id}
              className="flex items-center gap-3 rounded-lg border border-border p-4 opacity-50"
            >
              <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate line-through">
                  {k.name}
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  {k.keyPrefix}
                  {"..."}
                </p>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Create dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => !open && handleCloseCreate()}
      >
        <DialogContent className="sm:max-w-lg">
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
            <div className="space-y-4">
              {/* Raw key */}
              <div className="space-y-2">
                <Label>{t("secretKey")}</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={createdKey.key}
                    className="font-mono text-xs"
                  />
                  <Button variant="outline" size="icon" onClick={handleCopyKey}>
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-destructive font-medium">
                  {t("keyWontShowAgain")}
                </p>
              </div>

              {/* Config snippet */}
              <div className="space-y-2">
                <Label>{t("configSnippet")}</Label>
                <div className="relative">
                  <pre className="rounded-lg border border-border bg-muted p-3 text-xs font-mono overflow-x-auto whitespace-pre">
                    {getConfigSnippet()}
                  </pre>
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={handleCopySnippet}
                  >
                    {copiedSnippet ? (
                      <Check className="h-3 w-3 mr-1 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3 mr-1" />
                    )}
                    {t("copy")}
                  </Button>
                </div>
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
