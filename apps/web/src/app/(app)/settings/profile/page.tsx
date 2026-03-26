"use client";

import { Camera, Globe, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { School } from "@/lib/api";
import {
  ApiError,
  listSchools,
  requestEmailChange,
  updateProfile,
  uploadAvatar,
  getMe,
  getFileUrl,
} from "@/lib/api";

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

function getTimezoneOffset(tz: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(now);
    const offsetPart = parts.find((p) => p.type === "timeZoneName");
    return offsetPart?.value ?? "";
  } catch {
    return "";
  }
}

function getSupportedTimezones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    // Fallback for older browsers
    return [
      "UTC",
      "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
      "Europe/London", "Europe/Paris", "Europe/Berlin",
      "Asia/Tokyo", "Asia/Shanghai", "Asia/Singapore", "Asia/Kolkata",
      "Australia/Sydney", "Pacific/Auckland",
    ];
  }
}

function groupTimezones(timezones: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const tz of timezones) {
    const region = tz.includes("/") ? tz.split("/")[0] : "Other";
    if (!groups[region]) groups[region] = [];
    groups[region].push(tz);
  }
  return groups;
}

export default function ProfilePage() {
  const { token, user, updateUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [nickname, setNickname] = useState("");
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const browserTimezone = useMemo(() => getBrowserTimezone(), []);
  const allTimezones = useMemo(() => getSupportedTimezones(), []);
  const groupedTimezones = useMemo(() => groupTimezones(allTimezones), [allTimezones]);

  const loadData = useCallback(async () => {
    try {
      const schoolList = await listSchools();
      setSchools(schoolList);
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Sync form state when user data is available
  useEffect(() => {
    if (user) {
      setNickname(user.nickname ?? "");
      setSchoolId(user.schoolId);
      setStudentId(user.studentId ?? "");
      setTimezone(user.timezone);
    }
  }, [user]);

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    try {
      const updated = await updateProfile(token, {
        nickname: nickname.trim() || null,
        schoolId,
        studentId: schoolId ? studentId.trim() || null : null,
        timezone,
      });
      updateUser(updated);
      toast.success("Profile updated");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to update profile";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5MB");
      return;
    }

    setUploading(true);
    try {
      const attachment = await uploadAvatar(token, file);
      setAvatarUrl(getFileUrl(attachment.fileKey));
      // Reload user data to get updated profile
      const updated = await getMe(token);
      updateUser(updated);
      toast.success("Avatar updated");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to upload avatar";
      toast.error(message);
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  if (!user) {
    return null;
  }

  const displayName = user.nickname || user.email;
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="space-y-8">
      {/* Avatar */}
      <div className="space-y-2">
        <Label>Avatar</Label>
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="relative group"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Avatar className="h-20 w-20">
              {avatarUrl && (
                <AvatarImage src={avatarUrl} alt={displayName} />
              )}
              <AvatarFallback className="text-lg font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
              {uploading ? (
                <Loader2 className="h-5 w-5 text-white animate-spin" />
              ) : (
                <Camera className="h-5 w-5 text-white" />
              )}
            </div>
          </button>
          <div className="text-sm text-muted-foreground">
            Click to upload a new photo.
            <br />
            JPG, PNG or GIF. Max 5MB.
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
        </div>
      </div>

      {/* Nickname */}
      <div className="space-y-2">
        <Label htmlFor="nickname">Nickname</Label>
        <Input
          id="nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="How should we call you?"
          disabled={saving}
        />
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <div className="flex gap-2">
          <Input
            id="email"
            value={user.email}
            disabled
            className="opacity-60"
          />
          <ChangeEmailDialog token={token} />
        </div>
      </div>

      {/* School */}
      <div className="space-y-2">
        <Label>School</Label>
        {loading ? (
          <div className="h-10 bg-muted animate-pulse rounded-md" />
        ) : (
          <Select
            value={schoolId ?? "none"}
            onValueChange={(val) =>
              setSchoolId(val === "none" ? null : val)
            }
            disabled={saving}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select your school" />
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
        )}
      </div>

      {/* Student ID (visible when school selected) */}
      {schoolId && (
        <div className="space-y-2">
          <Label htmlFor="student-id">Student ID</Label>
          <Input
            id="student-id"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="Your student ID"
            disabled={saving}
          />
        </div>
      )}

      {/* Timezone */}
      <div className="space-y-2">
        <Label>Timezone</Label>
        <Select value={timezone} onValueChange={setTimezone} disabled={saving}>
          <SelectTrigger>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {browserTimezone !== timezone && (
              <SelectGroup>
                <SelectLabel>Detected</SelectLabel>
                <SelectItem value={browserTimezone}>
                  {browserTimezone} ({getTimezoneOffset(browserTimezone)})
                </SelectItem>
              </SelectGroup>
            )}
            {Object.entries(groupedTimezones).map(([region, tzList]) => (
              <SelectGroup key={region}>
                <SelectLabel>{region}</SelectLabel>
                {tzList.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz.replace(/_/g, " ")} ({getTimezoneOffset(tz)})
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Used for displaying dates and deadlines in your local time.
        </p>
      </div>

      {/* Save */}
      <Button onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Changes
      </Button>
    </div>
  );
}

function ChangeEmailDialog({ token }: { token: string | null }) {
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      setNewEmail("");
      setSent(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !newEmail) return;

    setSubmitting(true);
    try {
      await requestEmailChange(token, newEmail);
      setSent(true);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to send verification";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0">
          Change
        </Button>
      </DialogTrigger>
      <DialogContent>
        {sent ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif">Check your email</DialogTitle>
              <DialogDescription>
                We sent a verification link to <strong>{newEmail}</strong>.
                Click the link to confirm the change.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="font-serif">Change email address</DialogTitle>
              <DialogDescription>
                A verification link will be sent to your new email address.
                Your email won&apos;t change until you click the link.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="new-email">New email address</Label>
              <Input
                id="new-email"
                type="email"
                placeholder="new@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                autoFocus
                className="mt-2"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !newEmail}>
                {submitting ? "Sending..." : "Send verification"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
