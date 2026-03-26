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

  // Webhook notification state
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");

  const loadPrefs = useCallback(async () => {
    if (!token) return;
    try {
      const prefs = await getNotificationPrefs(token);

      const emailPref = prefs.find(
        (p: NotificationPref) => p.channel === "EMAIL",
      );
      if (emailPref) {
        setEmailEnabled(emailPref.isEnabled);
      }

      const webhookPref = prefs.find(
        (p: NotificationPref) => p.channel === "WEBHOOK",
      );
      if (webhookPref) {
        setWebhookEnabled(webhookPref.isEnabled);
        setWebhookUrl(webhookPref.address);
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
    if (webhookEnabled && !webhookUrl.trim()) {
      toast.error("Please enter a webhook URL");
      return;
    }

    setSaving(true);
    try {
      const promises: Promise<unknown>[] = [
        upsertNotificationPref(token, {
          channel: "EMAIL",
          address: user?.email ?? "",
          isEnabled: emailEnabled,
        }),
      ];

      // Only save webhook pref if user has interacted with it
      if (webhookEnabled || webhookUrl.trim()) {
        promises.push(
          upsertNotificationPref(token, {
            channel: "WEBHOOK",
            address: webhookUrl.trim() || "https://",
            isEnabled: webhookEnabled,
          }),
        );
      }

      await Promise.all(promises);
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
        {emailEnabled && user?.email && (
          <p className="text-sm text-muted-foreground rounded-lg border border-border px-4 py-3">
            Notifications will be sent to your account email ({user.email}).
          </p>
        )}
      </section>

      {/* Webhook Notifications */}
      <section className="space-y-5">
        <h2 className="text-heading-md">Webhook Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Send notification data as JSON to an external URL. Useful for bots,
          automation tools, or custom integrations.
        </p>
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <p className="text-sm font-medium">Enable webhook notifications</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              POST a JSON payload for each notification event
            </p>
          </div>
          <Switch
            checked={webhookEnabled}
            onCheckedChange={setWebhookEnabled}
            disabled={saving}
          />
        </div>
        {webhookEnabled && (
          <div className="space-y-2">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <Input
              id="webhook-url"
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://example.com/webhook"
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              We will POST a JSON body with task details to this URL.
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
