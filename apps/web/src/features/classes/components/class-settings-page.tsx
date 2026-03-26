"use client";

import { ArrowLeft, Copy, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
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

const PRESET_COLORS = [
  "#5B8C6A",
  "#7B6CB0",
  "#C4785B",
  "#5886A5",
  "#8B7355",
  "#B07090",
  "#6B8FA3",
  "#A0855B",
  "#7A9B6D",
  "#9B6B7A",
];

export function ClassSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();
  const classId = params?.classId as string;

  const [cls, setCls] = useState<ClassSummary | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState("");

  const loadData = useCallback(async () => {
    if (!token || !classId) return;
    try {
      const [classData, schoolList] = await Promise.all([
        getClass(token, classId),
        listSchools(),
      ]);
      setCls(classData);
      setSchools(schoolList);
      setName(classData.name);
      setDescription(classData.description ?? "");
      setColor(classData.color || PRESET_COLORS[0]);
      setSchoolId(classData.schoolId);
      setInviteCode(classData.inviteCode ?? "");
    } catch {
      toast.error("Failed to load class settings");
    } finally {
      setLoading(false);
    }
  }, [token, classId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleSave() {
    if (!token || !classId || !name.trim()) return;
    setSaving(true);
    try {
      const updated = await updateClass(token, classId, {
        name: name.trim(),
        description: description.trim() || null,
        color,
      });
      setCls(updated);
      toast.success("Class settings saved");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to save settings";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRefreshInviteCode() {
    if (!token || !classId) return;
    setRefreshing(true);
    try {
      const result = await refreshInviteCode(token, classId);
      setInviteCode(result.inviteCode);
      toast.success("Invite code refreshed");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to refresh invite code";
      toast.error(message);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleDelete() {
    if (!token || !classId) return;
    setDeleting(true);
    try {
      await deleteClass(token, classId);
      toast.success("Class deleted");
      router.push("/dashboard");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to delete class";
      toast.error(message);
      setDeleting(false);
    }
  }

  function handleCopyInviteCode() {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode).then(
      () => toast.success("Invite code copied"),
      () => toast.error("Failed to copy"),
    );
  }

  if (loading) {
    return (
      <div className="p-8 max-w-[640px] mx-auto">
        <div className="h-8 w-48 bg-muted animate-pulse rounded mb-8" />
        <div className="space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!cls) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Class not found.</p>
      </div>
    );
  }

  const isOwner = cls.myRole === "OWNER";

  return (
    <div className="p-8 max-w-[640px] mx-auto">
      <div className="mb-8">
        <Link
          href={`/classes/${classId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground mb-3"
        >
          <ArrowLeft size={14} strokeWidth={2} />
          Back to {cls.name}
        </Link>
        <h1 className="text-display mb-1">Class Settings</h1>
        <p className="text-muted-foreground">Manage settings for {cls.name}.</p>
      </div>

      {/* Basic Info */}
      <section className="space-y-5 mb-8">
        <h2 className="text-heading-md">Basic Info</h2>
        <div className="space-y-2">
          <Label htmlFor="class-name">Class Name</Label>
          <Input
            id="class-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Advanced Mathematics"
            disabled={saving}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="class-description">Description</Label>
          <Textarea
            id="class-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description..."
            rows={3}
            disabled={saving}
          />
        </div>
        <div className="space-y-2">
          <Label>Theme Color</Label>
          <div className="flex flex-wrap gap-2.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="h-8 w-8 rounded-lg transition-all"
                style={{
                  backgroundColor: c,
                  border:
                    color === c
                      ? "2.5px solid var(--foreground)"
                      : "2.5px solid transparent",
                  transform: color === c ? "scale(1.1)" : "scale(1)",
                }}
              />
            ))}
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          style={{ backgroundColor: color }}
          className="text-white hover:opacity-90"
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </section>

      <Separator className="my-8" />

      {/* School Restriction */}
      <section className="space-y-4 mb-8">
        <h2 className="text-heading-md">School Restriction</h2>
        <p className="text-sm text-muted-foreground">
          Restrict this class to members of a specific school.
        </p>
        <Select
          value={schoolId ?? "none"}
          onValueChange={(val) => {
            const newSchoolId = val === "none" ? null : val;
            setSchoolId(newSchoolId);
            if (token && classId) {
              updateClass(token, classId, {
                name: name.trim(),
                description: description.trim() || null,
                color,
              })
                .then(() => toast.success("School restriction updated"))
                .catch(() =>
                  toast.error("Failed to update school restriction"),
                );
            }
          }}
        >
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue placeholder="Select a school" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {schools.map((school) => (
              <SelectItem key={school.id} value={school.id}>
                {school.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <Separator className="my-8" />

      {/* Invite Code */}
      <section className="space-y-4 mb-8">
        <h2 className="text-heading-md">Invite Code</h2>
        <p className="text-sm text-muted-foreground">
          Share this code with students so they can join the class.
        </p>
        <div className="flex items-center gap-3">
          <code className="flex-1 rounded-md border border-border bg-surface-subtle px-4 py-2.5 font-mono text-lg tracking-widest">
            {inviteCode || "---"}
          </code>
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopyInviteCode}
            disabled={!inviteCode}
            title="Copy invite code"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={refreshing}
                title="Refresh invite code"
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Refresh Invite Code?</AlertDialogTitle>
                <AlertDialogDescription>
                  The current invite code will stop working. Anyone who has it
                  will need the new code to join. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRefreshInviteCode}>
                  Refresh Code
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>

      {/* Danger Zone */}
      {isOwner && (
        <>
          <Separator className="my-8" />
          <section className="rounded-lg border-2 border-destructive/30 p-6">
            <h2 className="text-heading-md text-destructive mb-2">
              Danger Zone
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Permanently delete this class and all its tasks, submissions, and
              member data. This action cannot be undone.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={deleting}>
                  {deleting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Delete Class
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete &quot;{cls.name}&quot;?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the class, including all tasks,
                    submissions, and member data. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete Class
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </section>
        </>
      )}
    </div>
  );
}
