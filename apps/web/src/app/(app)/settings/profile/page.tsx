"use client";

import { Camera, Globe, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
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
  getMe,
  getPresignedFileUrl,
  listSchools,
  requestEmailChange,
  updateProfile,
  uploadAvatar,
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
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles",
      "Europe/London",
      "Europe/Paris",
      "Europe/Berlin",
      "Asia/Tokyo",
      "Asia/Shanghai",
      "Asia/Singapore",
      "Asia/Kolkata",
      "Australia/Sydney",
      "Pacific/Auckland",
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
  const t = useTranslations("settingsProfile");
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
  const groupedTimezones = useMemo(
    () => groupTimezones(allTimezones),
    [allTimezones],
  );

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
      toast.success(t("profileUpdated"));
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("failedUpdateProfile");
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
      toast.error(t("selectImageFile"));
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("imageSmallerThan5mb"));
      return;
    }

    setUploading(true);
    try {
      const attachment = await uploadAvatar(token, file);
      const presigned = await getPresignedFileUrl(token, attachment.fileKey);
      setAvatarUrl(presigned);
      // Reload user data to get updated profile
      const updated = await getMe(token);
      updateUser(updated);
      toast.success(t("avatarUpdated"));
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("failedUploadAvatar");
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
        <Label>{t("avatar")}</Label>
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="relative group"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Avatar className="h-20 w-20">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
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
            {t("clickUploadPhoto")}
            <br />
            {t("acceptedImageTypes")}
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
        <Label htmlFor="nickname">{t("nickname")}</Label>
        <Input
          id="nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder={t("nicknamePlaceholder")}
          disabled={saving}
        />
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email">{t("email")}</Label>
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
        <Label>{t("school")}</Label>
        {loading ? (
          <div className="h-10 bg-muted animate-pulse rounded-md" />
        ) : (
          <Select
            value={schoolId ?? "none"}
            onValueChange={(val) => setSchoolId(val === "none" ? null : val)}
            disabled={saving}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("selectYourSchool")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("none")}</SelectItem>
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
          <Label htmlFor="student-id">{t("studentId")}</Label>
          <Input
            id="student-id"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder={t("studentIdPlaceholder")}
            disabled={saving}
          />
        </div>
      )}

      {/* Timezone */}
      <div className="space-y-2">
        <Label>{t("timezone")}</Label>
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
                <SelectLabel>{t("detected")}</SelectLabel>
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
        <p className="text-xs text-muted-foreground">{t("timezoneHint")}</p>
      </div>

      {/* Save */}
      <Button onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t("saveChanges")}
      </Button>
    </div>
  );
}

function ChangeEmailDialog({ token }: { token: string | null }) {
  const t = useTranslations("settingsProfile.changeEmail");
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
        err instanceof ApiError ? err.message : t("failedSendVerification");
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0">
          {t("change")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        {sent ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif">
                {t("checkYourEmail")}
              </DialogTitle>
              <DialogDescription>
                {t("sentVerificationPrefix")} <strong>{newEmail}</strong>。
                {t("sentVerificationSuffix")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                {t("close")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="font-serif">{t("title")}</DialogTitle>
              <DialogDescription>{t("description")}</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="new-email">{t("newEmailAddress")}</Label>
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
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={submitting || !newEmail}>
                {submitting ? t("sending") : t("sendVerification")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
