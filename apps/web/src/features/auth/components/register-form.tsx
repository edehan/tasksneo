"use client";

import { Mail } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CapWidget, getCapApiEndpoint } from "@/components/cap-widget";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, register, verifyCaptcha } from "@/lib/api";

export function RegisterForm() {
  const t = useTranslations("authRegister");
  const [email, setEmail] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaProof, setCaptchaProof] = useState<string | null>(null);
  const [captchaVerifying, setCaptchaVerifying] = useState(false);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  const capApiEndpoint = getCapApiEndpoint();
  const captchaEnabled = Boolean(capApiEndpoint);

  const resetCaptcha = useCallback(() => {
    setCaptchaToken(null);
    setCaptchaProof(null);
    setCaptchaResetKey((key) => key + 1);
  }, []);

  useEffect(() => {
    if (!captchaEnabled) return;
    resetCaptcha();
  }, [captchaEnabled, email, resetCaptcha]);

  useEffect(() => {
    if (!captchaEnabled) return;
    if (!captchaToken || !email) {
      setCaptchaProof(null);
      return;
    }

    let cancelled = false;
    setCaptchaVerifying(true);
    void verifyCaptcha({
      email,
      purpose: "REGISTRATION",
      captchaToken,
    })
      .then((result) => {
        if (cancelled) return;
        setCaptchaProof(result.captchaProof);
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err instanceof ApiError ? err.message : "Captcha verification failed";
        toast.error(message);
        resetCaptcha();
      })
      .finally(() => {
        if (!cancelled) {
          setCaptchaVerifying(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [captchaEnabled, captchaToken, email, resetCaptcha]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !agreedToTerms) return;

    if (captchaEnabled && !captchaProof) {
      toast.error("Please complete the captcha challenge.");
      return;
    }

    setSubmitting(true);
    try {
      await register(email, captchaProof ?? undefined);
      setSent(true);
      if (captchaEnabled) {
        resetCaptcha();
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("registrationFailed");
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (captchaEnabled && !captchaProof) {
      toast.error("Please complete the captcha challenge.");
      return;
    }

    setSubmitting(true);
    try {
      await register(email, captchaProof ?? undefined);
      toast.success(t("verificationEmailResent"));
      if (captchaEnabled) {
        resetCaptcha();
      }
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
            {t("sentVerificationPrefix")} <strong>{email}</strong>。
            {t("sentVerificationSuffix")}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p>{t("didNotReceive")}</p>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          {captchaEnabled && (
            <CapWidget
              apiEndpoint={capApiEndpoint}
              onTokenChange={setCaptchaToken}
              resetKey={captchaResetKey}
            />
          )}
          <Button
            variant="outline"
            className="w-full"
            onClick={handleResend}
            disabled={
              submitting || captchaVerifying || (captchaEnabled && !captchaProof)
            }
          >
            {submitting ? t("sending") : t("resendEmail")}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              setSent(false);
              setEmail("");
              setAgreedToTerms(false);
            }}
          >
            {t("useDifferentEmail")}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-serif">
          {t("createAccount")}
        </CardTitle>
        <CardDescription>{t("getStarted")}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reg-email">{t("email")}</Label>
            <Input
              id="reg-email"
              type="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
          </div>
          {captchaEnabled && (
            <CapWidget
              apiEndpoint={capApiEndpoint}
              onTokenChange={setCaptchaToken}
              resetKey={captchaResetKey}
            />
          )}
          <div className="flex items-start gap-2">
            <Checkbox
              id="reg-terms"
              checked={agreedToTerms}
              onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
            />
            <Label
              htmlFor="reg-terms"
              className="text-sm leading-snug font-normal"
            >
              {t("agreeTo")} {" "}
              <Link
                href="/terms"
                className="text-primary underline-offset-4 hover:underline"
                target="_blank"
              >
                {t("termsOfService")}
              </Link>{" "}
              {t("and")} {" "}
              <Link
                href="/privacy"
                className="text-primary underline-offset-4 hover:underline"
                target="_blank"
              >
                {t("privacyPolicy")}
              </Link>
            </Label>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button
            type="submit"
            className="w-full"
            disabled={
              submitting ||
              !agreedToTerms ||
              captchaVerifying ||
              (captchaEnabled && !captchaProof)
            }
          >
            {submitting ? t("sending") : t("continueWithEmail")}
          </Button>
          <p className="text-sm text-muted-foreground">
            {t("alreadyHaveAccount")} {" "}
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
