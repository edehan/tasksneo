"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
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

export default function NotificationsPage() {
  const { token, user } = useAuth();
  const t = useTranslations("settingsNotifications");

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
      toast.error(t("failedLoadPrefs"));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    void loadPrefs();
  }, [loadPrefs]);

  async function handleSave() {
    if (!token) return;
    if (webhookEnabled && !webhookUrl.trim()) {
      toast.error(t("pleaseEnterWebhookUrl"));
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
      toast.success(t("prefsSaved"));
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("failedSavePrefs");
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
        <h2 className="text-heading-md">{t("emailNotifications")}</h2>
        <p className="text-sm text-muted-foreground">{t("emailDescription")}</p>
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <p className="text-sm font-medium">{t("enableEmail")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("emailUpdatesHint")}
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
            {t("emailDestinationPrefix")} ({user.email}).
          </p>
        )}
      </section>

      {/* Webhook Notifications */}
      <section className="space-y-5">
        <h2 className="text-heading-md">{t("webhookNotifications")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("webhookDescription")}
        </p>
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <p className="text-sm font-medium">{t("enableWebhook")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("webhookHint")}
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
            <Label htmlFor="webhook-url">{t("webhookUrl")}</Label>
            <Input
              id="webhook-url"
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder={t("webhookUrlPlaceholder")}
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              {t("webhookPostHint")}
            </p>
          </div>
        )}
      </section>

      {/* Save */}
      <Button onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t("savePreferences")}
      </Button>
    </div>
  );
}
