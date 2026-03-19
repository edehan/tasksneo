"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import type { School } from "@/lib/api";
import {
  ApiError,
  getFileUrl,
  listSchools,
  updateProfile,
  uploadAvatar,
} from "@/lib/api";

export default function ProfileSettingsPage() {
  const { token, user, updateUser } = useAuth();

  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [schoolId, setSchoolId] = useState<string | null>(
    user?.schoolId ?? null,
  );
  const [studentId, setStudentId] = useState(user?.studentId ?? "");
  const [schools, setSchools] = useState<School[]>([]);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarKey, setAvatarKey] = useState<string | null>(null);

  const loadSchools = useCallback(async () => {
    try {
      const data = await listSchools();
      setSchools(data);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    void loadSchools();
  }, [loadSchools]);

  // Sync form when user data changes
  useEffect(() => {
    if (user) {
      setNickname(user.nickname ?? "");
      setSchoolId(user.schoolId ?? null);
      setStudentId(user.studentId ?? "");
    }
  }, [user]);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    setAvatarUploading(true);
    try {
      const att = await uploadAvatar(token, file);
      setAvatarKey(att.fileKey);
      toast.success("Avatar updated");
    } catch {
      toast.error("Failed to upload avatar");
    } finally {
      setAvatarUploading(false);
      e.target.value = "";
    }
  }

  async function handleSave() {
    if (!token) return;

    setSaving(true);
    try {
      const updated = await updateProfile(token, {
        nickname: nickname.trim() || null,
        schoolId,
        studentId: schoolId ? studentId.trim() || null : null,
      });
      updateUser(updated);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to update profile",
      );
    } finally {
      setSaving(false);
    }
  }

  const displayName = user?.nickname || user?.email || "User";
  const initials = displayName.slice(0, 2).toUpperCase();
  const avatarUrl = avatarKey ? getFileUrl(avatarKey) : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Profile</h2>
        <p className="text-sm text-muted-foreground">
          Manage your account information
        </p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <label className="cursor-pointer">
          <Avatar className="h-16 w-16">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
            disabled={avatarUploading}
          />
        </label>
        <div className="text-sm text-muted-foreground">
          {avatarUploading ? "Uploading..." : "Click avatar to change"}
        </div>
      </div>

      <div className="space-y-4">
        {/* Nickname */}
        <div className="space-y-2">
          <Label htmlFor="nickname">Nickname</Label>
          <Input
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Display name"
            disabled={saving}
          />
        </div>

        {/* Email (read-only) */}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            value={user?.email ?? ""}
            disabled
            className="text-muted-foreground"
          />
        </div>

        {/* School */}
        {schools.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="school">School</Label>
            <Select
              value={schoolId ?? "none"}
              onValueChange={(v) => {
                setSchoolId(v === "none" ? null : v);
                if (v === "none") setStudentId("");
              }}
            >
              <SelectTrigger id="school">
                <SelectValue placeholder="No school" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No school</SelectItem>
                {schools.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Student ID (conditional) */}
        {schoolId && (
          <div className="space-y-2">
            <Label htmlFor="student-id">
              Student ID <span className="text-status-error">*</span>
            </Label>
            <Input
              id="student-id"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="Your student ID"
              disabled={saving}
            />
          </div>
        )}
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save
      </Button>
    </div>
  );
}
