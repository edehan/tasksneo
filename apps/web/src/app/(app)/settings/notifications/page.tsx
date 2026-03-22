"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { NotificationPref } from "@/lib/api";
import { ApiError, getNotificationPrefs, upsertNotificationPref } from "@/lib/api";

export default function NotificationsPage() {
  const { token, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Email notification state
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");

  const loadPrefs = useCallback(async () => {
    if (!token) return;
    try {
      const prefs = await getNotificationPrefs(token);
      const emailPref = prefs.find(
        (p: NotificationPref) => p.channel === "EMAIL",
      );
      if (emailPref) {
        setEmailEnabled(emailPref.isEnabled);
        setEmailAddress(emailPref.address);
      } else {
        // Default to user email
        setEmailAddress(user?.email ?? "");
      }
    } catch {
      toast.error("Failed to load notification preferences");
    } finally {
      setLoading(false);
    }
  }, [token, user?.email]);

  useEffect(() => {
    void loadPrefs();
  }, [loadPrefs]);

  async function handleSave() {
    if (!token) return;
    if (emailEnabled && !emailAddress.trim()) {
      toast.error("Please enter an email address");
      return;
    }
    setSaving(true);
    try {
      await upsertNotificationPref(token, {
        channel: "EMAIL",
        address: emailAddress.trim(),
        isEnabled: emailEnabled,
      });
      toast.success("Notification preferences saved");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to save notification preferences";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

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
      {/* Email Notifications */}
      <section className="space-y-5">
        <h2 className="text-heading-md">Email Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Receive email notifications when new tasks are posted or deadlines are
          approaching.
        </p>
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <p className="text-sm font-medium">Enable email notifications</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Get notified about task updates via email
            </p>
          </div>
          <Switch
            checked={emailEnabled}
            onCheckedChange={setEmailEnabled}
            disabled={saving}
          />
        </div>
        {emailEnabled && (
          <div className="space-y-2">
            <Label htmlFor="notification-email">Notification Email</Label>
            <Input
              id="notification-email"
              type="email"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              placeholder="your@email.com"
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              Defaults to your account email if left unchanged.
            </p>
          </div>
        )}
      </section>

      {/* Save */}
      <Button onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Preferences
      </Button>
    </div>
  );
}
