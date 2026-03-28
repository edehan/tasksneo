"use client";

import { Mail } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
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
import { ApiError, requestPasswordReset } from "@/lib/api";

export default function ForgotPasswordPage() {
  const t = useTranslations("authForgotPassword");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
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
      await requestPasswordReset(email);
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
        <CardFooter className="flex flex-col gap-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleResend}
            disabled={submitting}
          >
            {submitting ? t("sending") : t("resendEmail")}
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
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? t("sending") : t("sendResetLink")}
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
