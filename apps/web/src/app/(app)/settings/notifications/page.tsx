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
import {
  ApiError,
  getNotificationPrefs,
  upsertNotificationPref,
} from "@/lib/api";

export default function NotificationSettingsPage() {
  const { token, user } = useAuth();

  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const prefs = await getNotificationPrefs(token);
      const emailPref = prefs.find(
        (p: NotificationPref) => p.channel === "EMAIL",
      );
      if (emailPref) {
        setEmailEnabled(emailPref.isEnabled);
        setEmailAddress(emailPref.address);
      } else {
        // Default: use registration email
        setEmailAddress(user?.email ?? "");
      }
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  }, [token, user?.email]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    if (!token) return;

    setSaving(true);
    try {
      await upsertNotificationPref(token, {
        channel: "EMAIL",
        address: emailAddress.trim() || user?.email || "",
        isEnabled: emailEnabled,
      });
      toast.success("Notification preferences saved");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to save preferences",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Configure how you receive notifications
        </p>
      </div>

      {loading ? (
        <div className="h-32 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Email notifications */}
          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="email-toggle" className="text-sm font-medium">
                  Email notifications
                </Label>
                <p className="text-xs text-muted-foreground">
                  Receive task reminders and updates via email
                </p>
              </div>
              <Switch
                id="email-toggle"
                checked={emailEnabled}
                onCheckedChange={setEmailEnabled}
                disabled={saving}
              />
            </div>

            {emailEnabled && (
              <div className="space-y-2">
                <Label htmlFor="email-address">Email address</Label>
                <Input
                  id="email-address"
                  type="email"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  placeholder={user?.email ?? "your@email.com"}
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">
                  Defaults to your registration email if left empty.
                </p>
              </div>
            )}
          </div>

          {/* Placeholder for future channels */}
          <div className="rounded-lg border border-dashed p-4">
            <p className="text-sm text-muted-foreground">
              More notification channels (Webhook, Telegram) coming soon.
            </p>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
