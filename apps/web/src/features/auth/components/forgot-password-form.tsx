"use client";

import { Mail } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { CaptchaWidget, isCaptchaEnabled } from "@/components/captcha-widget";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCooldown } from "@/hooks/use-cooldown";
import { ApiError, requestPasswordReset } from "@/lib/api";

const EMAIL_SEND_COOLDOWN_SECONDS = 60;

export function ForgotPasswordForm() {
  const t = useTranslations("authForgotPassword");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const resetCaptcha = useCallback(() => setCaptchaToken(null), []);
  const { coolingDown, remainingSeconds, startCooldown } = useCooldown();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setSubmitting(true);
    try {
      await requestPasswordReset(email, captchaToken);
      setSent(true);
      setCaptchaToken(null);
      startCooldown(EMAIL_SEND_COOLDOWN_SECONDS);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("somethingWentWrong");
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setSubmitting(true);
    try {
      await requestPasswordReset(email, captchaToken);
      setCaptchaToken(null);
      startCooldown(EMAIL_SEND_COOLDOWN_SECONDS);
      toast.success(t("resetEmailResent"));
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("failedResendEmail");
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-serif">
            {t("checkYourEmail")}
          </CardTitle>
          <CardDescription>
            {t("accountExistsPrefix")} <strong>{email}</strong>
            {t("accountExistsSuffix")}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p>{t("didNotReceive")}</p>
        </CardContent>
        <CardContent>
          <CaptchaWidget
            action="password_reset"
            onSolve={setCaptchaToken}
            onReset={resetCaptcha}
          />
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleResend}
            disabled={
              submitting || coolingDown || (isCaptchaEnabled() && !captchaToken)
            }
          >
            {submitting
              ? t("sending")
              : coolingDown
                ? `${t("resendEmail")} (${remainingSeconds}s)`
                : t("resendEmail")}
          </Button>
          <Button variant="ghost" className="w-full" asChild>
            <Link href="/login">{t("backToSignIn")}</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-serif">
          {t("resetYourPassword")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-email">{t("email")}</Label>
            <Input
              id="reset-email"
              type="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
          </div>
          <CaptchaWidget
            action="password_reset"
            onSolve={setCaptchaToken}
            onReset={resetCaptcha}
          />
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button
            type="submit"
            className="w-full"
            disabled={
              submitting || coolingDown || (isCaptchaEnabled() && !captchaToken)
            }
          >
            {submitting
              ? t("sending")
              : coolingDown
                ? `${t("sendResetLink")} (${remainingSeconds}s)`
                : t("sendResetLink")}
          </Button>
          <p className="text-sm text-muted-foreground">
            {t("rememberPassword")}{" "}
            <Link
              href="/login"
              className="text-primary underline-offset-4 hover:underline"
            >
              {t("signIn")}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
