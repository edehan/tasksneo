"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { School } from "@/lib/api";
import {
  ApiError,
  completeRegistration,
  listSchools,
  verifyToken,
} from "@/lib/api";
import { readSafeNextParam, readWindowSearchParam } from "@/lib/search-params";

function detectBrowserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz.length <= 64) return tz;
  } catch {
    // fallback
  }
  return "UTC";
}

function CompleteRegistrationInner() {
  const router = useRouter();
  const { setAuth } = useAuth();
  const t = useTranslations("authRegisterComplete");

  const [token, setToken] = useState<string | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(true);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState("");
  const [schools, setSchools] = useState<School[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const detectedTimezone = detectBrowserTimezone();

  useEffect(() => {
    const searchToken = readWindowSearchParam("token");
    setToken(searchToken);
    setNext(readSafeNextParam());

    if (!searchToken) {
      setError(t("missingVerificationToken"));
      setVerifying(false);
      return;
    }

    verifyToken(searchToken, "REGISTRATION")
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

  const loadSchools = useCallback(async () => {
    try {
      const data = await listSchools();
      setSchools(data);
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    if (verifiedEmail) {
      void loadSchools();
    }
  }, [verifiedEmail, loadSchools]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !password) return;

    if (password !== confirmPassword) {
      toast.error(t("passwordsDoNotMatch"));
      return;
    }

    if (schoolId && !studentId.trim()) {
      toast.error(t("studentIdRequired"));
      return;
    }

    setSubmitting(true);
    try {
      const res = await completeRegistration({
        token,
        password,
        nickname: nickname || undefined,
        schoolId: schoolId || undefined,
        studentId: schoolId ? studentId : undefined,
        timezone: detectedTimezone,
      });
      setAuth("", res.user);
      router.replace(next ?? "/dashboard");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("registrationFailed");
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
            <Link href="/register">{t("backToRegistration")}</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-serif">
          {t("completeAccount")}
        </CardTitle>
        <CardDescription>
          {t("setupProfileFor")} <strong>{verifiedEmail}</strong>
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="comp-password">{t("password")}</Label>
            <Input
              id="comp-password"
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
            <Label htmlFor="comp-confirm-password">
              {t("confirmPassword")}
            </Label>
            <Input
              id="comp-confirm-password"
              type="password"
              placeholder={t("repeatPassword")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="comp-nickname">
              {t("nickname")}{" "}
              <span className="text-muted-foreground">{t("optional")}</span>
            </Label>
            <Input
              id="comp-nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t("nicknamePlaceholder")}
            />
          </div>
          {schools.length > 0 && (
            <>
              <div className="space-y-2">
                <Label>
                  {t("school")}{" "}
                  <span className="text-muted-foreground">{t("optional")}</span>
                </Label>
                <Select
                  value={schoolId ?? "none"}
                  onValueChange={(v) => {
                    setSchoolId(v === "none" ? null : v);
                    if (v === "none") setStudentId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectSchool")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("noSchool")}</SelectItem>
                    {schools.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {schoolId && (
                <div className="space-y-2">
                  <Label htmlFor="comp-studentId">{t("studentId")}</Label>
                  <Input
                    id="comp-studentId"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    required
                    placeholder={t("studentNumberPlaceholder")}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? t("creatingAccount") : t("createAccount")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function CompleteRegistrationPage() {
  return <CompleteRegistrationInner />;
}
