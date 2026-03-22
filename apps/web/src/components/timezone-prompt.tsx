"use client";

import { Globe } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { ApiError, updateProfile } from "@/lib/api";
import { toast } from "sonner";

const DISMISS_KEY = "taskflow_tz_dismiss";

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

/** Returns the current UTC offset in minutes for a given IANA timezone. */
function getUtcOffsetMinutes(tz: string): number {
  try {
    const now = new Date();
    // Format in the target timezone and parse back to compare
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);

    const tzDate = new Date(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second"),
    );

    // UTC equivalent
    const utcFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const utcParts = utcFormatter.formatToParts(now);
    const getUtc = (type: Intl.DateTimeFormatPartTypes) =>
      parseInt(utcParts.find((p) => p.type === type)?.value ?? "0", 10);

    const utcDate = new Date(
      getUtc("year"),
      getUtc("month") - 1,
      getUtc("day"),
      getUtc("hour"),
      getUtc("minute"),
      getUtc("second"),
    );

    return Math.round((tzDate.getTime() - utcDate.getTime()) / 60000);
  } catch {
    return 0;
  }
}

function formatOffset(tz: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
  } catch {
    return tz;
  }
}

export function TimezonePrompt() {
  const { token, user, updateUser } = useAuth();
  const [visible, setVisible] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [browserTz, setBrowserTz] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const detected = getBrowserTimezone();
    const saved = user.timezone;

    // Same timezone name — no prompt needed
    if (detected === saved) return;

    // Different name but same real offset — no prompt needed (e.g. alias timezones)
    const detectedOffset = getUtcOffsetMinutes(detected);
    const savedOffset = getUtcOffsetMinutes(saved);
    if (detectedOffset === savedOffset) return;

    // Check if user already dismissed for this specific mismatch
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed === `${saved}:${detected}`) return;

    setBrowserTz(detected);
    setVisible(true);
  }, [user]);

  const handleUpdate = useCallback(async () => {
    if (!token || !browserTz) return;
    setUpdating(true);
    try {
      const updated = await updateProfile(token, { timezone: browserTz });
      updateUser(updated);
      setVisible(false);
      localStorage.removeItem(DISMISS_KEY);
      toast.success(`Timezone updated to ${browserTz}`);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to update timezone";
      toast.error(message);
    } finally {
      setUpdating(false);
    }
  }, [token, browserTz, updateUser]);

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
          Your browser timezone is{" "}
          <span className="font-medium">
            {browserTz} ({formatOffset(browserTz)})
          </span>
          , but your account is set to{" "}
          <span className="font-medium">
            {user.timezone} ({formatOffset(user.timezone)})
          </span>
          . Update to match your current location?
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            disabled={updating}
          >
            Dismiss
          </Button>
          <Button size="sm" onClick={handleUpdate} disabled={updating}>
            {updating ? "Updating..." : "Update"}
          </Button>
        </div>
      </div>
    </div>
  );
}
