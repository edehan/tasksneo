"use client";

import { Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { ApiError, updateProfile } from "@/lib/api";
import {
  formatDateInTimeZone,
  getBrowserTimeZone,
  getTimeZoneOffsetMinutes,
} from "@/lib/timezone";

const DISMISS_KEY = "taskflow_tz_dismiss";

export function TimezonePrompt() {
  const { user, updateUser } = useAuth();
  const t = useTranslations("timezonePrompt");
  const locale = useLocale();
  const [visible, setVisible] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [browserTz, setBrowserTz] = useState<string | null>(null);
  const [accountTime, setAccountTime] = useState("");

  useEffect(() => {
    if (!user) return;

    const detected = getBrowserTimeZone();
    const saved = user.timezone;

    // Same timezone name — no prompt needed
    if (detected === saved) return;

    // Different name but same current real offset — no prompt needed.
    const now = new Date();
    const detectedOffset = getTimeZoneOffsetMinutes(now, detected);
    const savedOffset = getTimeZoneOffsetMinutes(now, saved);
    if (detectedOffset === savedOffset) return;

    // Check if user already dismissed for this specific mismatch
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed === `${saved}:${detected}`) return;

    setBrowserTz(detected);
    setAccountTime(
      formatDateInTimeZone(now, locale, saved, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    );
    setVisible(true);
  }, [user, locale]);

  const handleUpdate = useCallback(async () => {
    if (!user || !browserTz) return;
    setUpdating(true);
    try {
      const updated = await updateProfile({ timezone: browserTz });
      updateUser(updated);
      setVisible(false);
      localStorage.removeItem(DISMISS_KEY);
      toast.success(t("updatedTo", { timezone: browserTz }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t("failedUpdate");
      toast.error(message);
    } finally {
      setUpdating(false);
    }
  }, [user, browserTz, updateUser, t]);

  const handleDismiss = useCallback(() => {
    if (user && browserTz) {
      localStorage.setItem(DISMISS_KEY, `${user.timezone}:${browserTz}`);
    }
    setVisible(false);
  }, [user, browserTz]);

  if (!visible || !browserTz || !user) return null;

  return (
    <div className="border-b border-border bg-card px-4 py-3">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="flex-1 text-sm text-foreground">
          {t("accountTimezonePrefix")}{" "}
          <span className="font-medium">{user.timezone}</span>
          {t("accountTimePrefix")}{" "}
          <span className="font-medium">{accountTime}</span>
          {t("browserTimezonePrefix")}{" "}
          <span className="font-medium">{browserTz}</span>
          {t("updateQuestion")}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            disabled={updating}
          >
            {t("continueUsing", { timezone: user.timezone })}
          </Button>
          <Button size="sm" onClick={handleUpdate} disabled={updating}>
            {updating ? t("updating") : t("updateTo", { timezone: browserTz })}
          </Button>
        </div>
      </div>
    </div>
  );
}
