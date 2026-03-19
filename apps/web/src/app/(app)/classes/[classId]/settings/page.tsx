"use client";

import { AlertTriangle, Check, Copy, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { useAuth } from "@/components/auth-provider";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { ClassSummary, School } from "@/lib/api";
import {
  ApiError,
  deleteClass,
  getClass,
  listSchools,
  refreshInviteCode,
  updateClass,
} from "@/lib/api";

const CLASS_COLORS = [
  { value: "#6366f1", label: "Indigo" },
  { value: "#0ea5e9", label: "Sky" },
  { value: "#10b981", label: "Emerald" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ec4899", label: "Pink" },
  { value: "#8b5cf6", label: "Violet" },
  { value: "#14b8a6", label: "Teal" },
  { value: "#f97316", label: "Orange" },
];

export default function ClassSettingsPage() {
  const { token } = useAuth();
  const params = useParams<{ classId: string }>();
  const router = useRouter();
  const classId = params.classId;

  const [cls, setCls] = useState<ClassSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<School[]>([]);

  // Form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [classData, schoolData] = await Promise.all([
        getClass(token, classId),
        listSchools(),
      ]);
      setCls(classData);
      setName(classData.name);
      setDescription(classData.description ?? "");
      setColor(classData.color);
      setSchoolId(classData.schoolId);
      setInviteCode(classData.inviteCode ?? "");
      setSchools(schoolData);
    } catch {
      toast.error("Failed to load class settings");
    } finally {
      setLoading(false);
    }
  }, [token, classId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    if (!token || !name.trim()) return;
    setSaving(true);
    try {
      const updated = await updateClass(token, classId, {
        name: name.trim(),
        description: description.trim() || null,
        color,
      });
      setCls(updated);
      toast.success("Class updated");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to update class",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRefreshCode() {
    if (!token) return;
    setRefreshing(true);
    try {
      const result = await refreshInviteCode(token, classId);
      setInviteCode(result.inviteCode);
      toast.success("Invite code refreshed. Old code is now invalid.");
    } catch {
      toast.error("Failed to refresh invite code");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleCopyCode() {
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  }

  async function handleDelete() {
    if (!token) return;
    setDeleting(true);
    try {
      await deleteClass(token, classId);
      toast.success("Class deleted");
      router.push("/classes");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete class",
      );
      setDeleting(false);
    }
  }

  const isOwner = cls?.myRole === "OWNER";

  return (
    <>
      <AppHeader title="Class Settings" />
      <div className="mx-auto max-w-160 p-6 space-y-6">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : !cls ? (
          <p className="text-muted-foreground">Class not found.</p>
        ) : (
          <>
            <PageHeader title="Class Settings">
              <Button asChild variant="ghost" size="sm">
                <Link href={`/classes/${classId}/members`}>Manage members</Link>
              </Button>
            </PageHeader>

            {/* Basic info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="class-name">
                  Name <span className="text-status-error">*</span>
                </Label>
                <Input
                  id="class-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="class-desc">Description</Label>
                <Textarea
                  id="class-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  disabled={saving}
                />
              </div>

              {/* Color */}
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2">
                  {CLASS_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setColor(c.value)}
                      className="flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-110"
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    >
                      {color === c.value && (
                        <Check className="h-4 w-4 text-white" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* School restriction (read-only display) */}
              {schools.length > 0 && (
                <div className="space-y-2">
                  <Label>School restriction</Label>
                  <Select
                    value={schoolId ?? "none"}
                    onValueChange={(v) => setSchoolId(v === "none" ? null : v)}
                    disabled
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No restriction</SelectItem>
                      {schools.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    School restriction cannot be changed after creation.
                  </p>
                </div>
              )}

              <Button onClick={handleSave} disabled={saving || !name.trim()}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </div>

            <Separator />

            {/* Invite code */}
            <div className="space-y-3">
              <Label>Invite code</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md border bg-muted px-3 py-2 font-mono text-sm">
                  {inviteCode}
                </code>
                <Button variant="outline" size="sm" onClick={handleCopyCode}>
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefreshCode}
                  disabled={refreshing}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                  />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Refreshing the code will invalidate the old one immediately.
              </p>
            </div>

            {/* Danger zone — only for OWNER */}
            {isOwner && (
              <>
                <Separator />
                <div className="rounded-lg border border-status-error/30 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-error" />
                    <div>
                      <h3 className="font-medium text-status-error">
                        Delete class
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Permanently delete this class. Tasks with submissions
                        will be preserved but detached.
                      </p>
                    </div>
                  </div>

                  <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                    <DialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        Delete class
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete "{cls.name}"?</DialogTitle>
                        <DialogDescription>
                          This will permanently delete the class and remove all
                          members. Tasks with submissions will be preserved but
                          detached from the class.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button
                          variant="ghost"
                          onClick={() => setDeleteOpen(false)}
                          disabled={deleting}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleDelete}
                          disabled={deleting}
                        >
                          {deleting && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Delete
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
