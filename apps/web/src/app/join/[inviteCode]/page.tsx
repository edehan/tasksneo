"use client";

import { Loader2, LogIn, Users } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApiError, joinClass } from "@/lib/api";

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const { token, user, loading } = useAuth();
  const t = useTranslations("joinPage");
  const inviteCode = params?.inviteCode as string;

  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect to login if not authenticated
  if (!loading && !token) {
    router.replace(`/login?next=${encodeURIComponent(`/join/${inviteCode}`)}`);
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  async function handleJoin() {
    if (!token || !inviteCode) return;
    setJoining(true);
    setError(null);
    try {
      const cls = await joinClass(token, inviteCode);
      router.replace(`/classes/${cls.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        switch (err.code) {
          case "INVITE_CODE_NOT_FOUND":
            setError(t("invalidInviteCode"));
            break;
          case "ALREADY_MEMBER":
            setError(t("alreadyMember"));
            break;
          case "SCHOOL_MISMATCH":
            setError(t("schoolMismatch"));
            break;
          default:
            setError(err.message);
        }
      } else {
        setError(t("joinFailed"));
      }
      setJoining(false);
    }
  }

  const displayName = user?.nickname || user?.email || "";

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="absolute top-4 right-4">
        <LocaleSwitcher />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-serif">{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">
              {t("inviteCodeLabel")}
            </p>
            <code className="block rounded-md border border-border bg-surface-subtle px-4 py-2.5 font-mono text-lg tracking-widest text-center">
              {inviteCode}
            </code>
          </div>
          {displayName && (
            <p className="text-sm text-muted-foreground text-center">
              <LogIn className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
              {t("joiningAs", { name: displayName })}
            </p>
          )}
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive text-center">
              {error}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          {!error ? (
            <>
              <Button
                className="w-full"
                onClick={handleJoin}
                disabled={joining}
              >
                {joining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {joining ? t("joining") : t("join")}
              </Button>
              <Button variant="ghost" className="w-full" asChild>
                <Link href="/dashboard">{t("cancel")}</Link>
              </Button>
            </>
          ) : (
            <Button variant="outline" className="w-full" asChild>
              <Link href="/dashboard">{t("goToDashboard")}</Link>
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
