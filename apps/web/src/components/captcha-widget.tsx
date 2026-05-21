"use client";

import { useEffect, useRef } from "react";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const TURNSTILE_SCRIPT_ID = "cf-turnstile-script";
const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type CaptchaAction =
  | "register"
  | "password_reset"
  | "email_change"
  | "account_delete";
type TurnstileWidgetId = string;

interface TurnstileRenderOptions {
  sitekey: string;
  action: CaptchaAction;
  size: "flexible";
  theme: "auto";
  appearance: "always";
  execution: "render";
  language: "auto";
  "refresh-expired": "auto";
  "response-field": false;
  callback: (token: string) => void;
  "error-callback": () => void;
  "expired-callback": () => void;
  "timeout-callback": () => void;
  "unsupported-callback": () => void;
}

interface TurnstileApi {
  render: (
    container: string | HTMLElement,
    options: TurnstileRenderOptions,
  ) => TurnstileWidgetId;
  remove: (widgetId: TurnstileWidgetId) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

interface CaptchaWidgetProps {
  action: CaptchaAction;
  onSolve: (token: string) => void;
  onReset?: () => void;
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.turnstile) {
    return Promise.resolve();
  }

  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(
      TURNSTILE_SCRIPT_ID,
    ) as HTMLScriptElement | null;

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(), { once: true });
    document.head.appendChild(script);
  });

  scriptPromise.catch(() => {
    scriptPromise = null;
  });

  return scriptPromise;
}

export function CaptchaWidget({
  action,
  onSolve,
  onReset,
}: CaptchaWidgetProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;

    let cancelled = false;
    let widgetId: TurnstileWidgetId | null = null;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;

        widgetId = window.turnstile.render(ref.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action,
          size: "flexible",
          theme: "auto",
          appearance: "always",
          execution: "render",
          language: "auto",
          "refresh-expired": "auto",
          "response-field": false,
          callback: onSolve,
          "error-callback": () => onReset?.(),
          "expired-callback": () => onReset?.(),
          "timeout-callback": () => onReset?.(),
          "unsupported-callback": () => onReset?.(),
        });
      })
      .catch(() => onReset?.());

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId);
      }
    };
  }, [action, onSolve, onReset]);

  if (!TURNSTILE_SITE_KEY) {
    return null;
  }

  return <div ref={ref} className="min-h-[65px] w-full" />;
}

export function isCaptchaEnabled(): boolean {
  return !!TURNSTILE_SITE_KEY;
}
