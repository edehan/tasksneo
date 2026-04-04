"use client";

import Script from "next/script";
import { useEffect, useMemo, useRef } from "react";
import { getApiBaseUrl } from "@/lib/api";

type CapSolveEvent = Event & {
  detail?: {
    token?: string;
  };
};

type CapWidgetElement = HTMLElement & {
  reset?: () => void;
};

const DEFAULT_CAP_WIDGET_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/@cap.js/widget";

export function getCapApiEndpoint() {
  const configured = process.env.NEXT_PUBLIC_CAP_API_ENDPOINT?.trim();
  if (configured) {
    return configured;
  }

  return `${getApiBaseUrl().replace(/\/+$/, "")}/cap/`;
}

function getCapWidgetScriptUrl() {
  const configured = process.env.NEXT_PUBLIC_CAP_WIDGET_SCRIPT_URL?.trim();
  return configured || DEFAULT_CAP_WIDGET_SCRIPT_URL;
}

export function CapWidget({
  apiEndpoint,
  onTokenChange,
  resetKey,
}: {
  apiEndpoint: string;
  onTokenChange: (token: string | null) => void;
  resetKey?: number;
}) {
  const widgetRef = useRef<CapWidgetElement | null>(null);
  const widgetScriptUrl = useMemo(() => getCapWidgetScriptUrl(), []);

  useEffect(() => {
    const widget = widgetRef.current;
    if (!widget) return;

    const handleSolve = (event: Event) => {
      const token = (event as CapSolveEvent).detail?.token;
      onTokenChange(token ?? null);
    };
    const handleReset = () => onTokenChange(null);

    widget.addEventListener("solve", handleSolve as EventListener);
    widget.addEventListener("reset", handleReset);
    widget.addEventListener("expire", handleReset);
    widget.addEventListener("error", handleReset);

    return () => {
      widget.removeEventListener("solve", handleSolve as EventListener);
      widget.removeEventListener("reset", handleReset);
      widget.removeEventListener("expire", handleReset);
      widget.removeEventListener("error", handleReset);
    };
  }, [onTokenChange]);

  useEffect(() => {
    onTokenChange(null);
    if (widgetRef.current?.reset) {
      widgetRef.current.reset();
    }
  }, [apiEndpoint, onTokenChange, resetKey]);

  if (!apiEndpoint) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Script src={widgetScriptUrl} strategy="afterInteractive" />
      <cap-widget
        ref={widgetRef}
        data-cap-api-endpoint={apiEndpoint}
        className="block min-h-16"
      />
    </div>
  );
}
