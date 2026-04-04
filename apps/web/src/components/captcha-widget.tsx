"use client";

import { useCallback, useEffect, useRef } from "react";

function getCapEndpoint(): string | undefined {
  if (process.env.NEXT_PUBLIC_CAP_ENABLED !== "true") return undefined;
  if (process.env.NEXT_PUBLIC_CAP_API_ENDPOINT)
    return process.env.NEXT_PUBLIC_CAP_API_ENDPOINT;
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBase) return undefined;
  return `${apiBase.replace(/\/+$/, "")}/cap/`;
}

const CAP_API_ENDPOINT = getCapEndpoint();

interface CaptchaWidgetProps {
  onSolve: (token: string) => void;
  onReset?: () => void;
}

export function CaptchaWidget({ onSolve, onReset }: CaptchaWidgetProps) {
  const ref = useRef<HTMLElement>(null);

  const handleSolve = useCallback(
    (e: Event) => {
      const token = (e as CustomEvent<{ token: string }>).detail.token;
      onSolve(token);
    },
    [onSolve],
  );

  const handleReset = useCallback(() => {
    onReset?.();
  }, [onReset]);

  useEffect(() => {
    import("@cap.js/widget");
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.addEventListener("solve", handleSolve);
    el.addEventListener("reset", handleReset);

    return () => {
      el.removeEventListener("solve", handleSolve);
      el.removeEventListener("reset", handleReset);
    };
  }, [handleSolve, handleReset]);

  if (!CAP_API_ENDPOINT) {
    return null;
  }

  return <cap-widget ref={ref} data-cap-api-endpoint={CAP_API_ENDPOINT} />;
}

export function isCaptchaEnabled(): boolean {
  return !!CAP_API_ENDPOINT;
}
