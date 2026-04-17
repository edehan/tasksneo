"use client";

export const dynamic = "force-static";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
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
import { ApiError, resetPassword, verifyToken } from "@/lib/api";
import { readWindowSearchParam } from "@/lib/search-params";

export default function ResetPasswordPage() {
  const router = useRouter();
  const t = useTranslations("authResetPassword");
  const { setAuth } = useAuth();

  const [token, setToken] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(true);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const searchToken = readWindowSearchParam("token");
    setToken(searchToken);

    if (!searchToken) {
      setError(t("missingResetToken"));
      setVerifying(false);
      return;
    }

    verifyToken(searchToken, "PASSWORD_RESET")
      .then((res) => {
        if (res.valid) {
          setVerifiedEmail(res.email);
        } else {
          setError(t("invalidOrExpiredLink"));
        }
      })
      .catch(() => {
        setError(t("invalidOrExpiredLink"));
      })
      .finally(() => setVerifying(false));
  }, [t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !password) return;

    if (password !== confirmPassword) {
      toast.error(t("passwordsDoNotMatch"));
      return;
    }

    setSubmitting(true);
    try {
      const result = await resetPassword(token, password);
      setAuth(result.user);
      toast.success(t("passwordResetSuccess"));
      router.replace("/");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("passwordResetFailed");
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (verifying) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-serif">
            {t("linkExpired")}
          </CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Button asChild variant="outline">
            <Link href="/forgot-password">{t("requestNewLink")}</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-serif">
          {t("setNewPassword")}
        </CardTitle>
        <CardDescription>
          {t("enterNewPasswordFor")} <strong>{verifiedEmail}</strong>
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">{t("newPassword")}</Label>
            <Input
              id="new-password"
              type="password"
              placeholder={t("atLeast8Characters")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-new-password">
              {t("confirmNewPassword")}
            </Label>
            <Input
              id="confirm-new-password"
              type="password"
              placeholder={t("repeatPassword")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? t("resetting") : t("resetPassword")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
