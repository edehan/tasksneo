"use client";

import { CheckCircle2, Loader2, LogIn, School, Users } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import {
  ApiError,
  getJoinClassPreview,
  type JoinClassPreview,
  joinClass,
} from "@/lib/api";

function PreviewBanner({
  tone,
  children,
}: {
  tone: "default" | "success" | "warning";
  children: React.ReactNode;
}) {
  const className =
    tone === "success"
      ? "rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5 text-sm text-primary"
      : tone === "warning"
        ? "rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        : "rounded-lg border border-border bg-surface-subtle px-3 py-2.5 text-sm text-muted-foreground";

  return <div className={className}>{children}</div>;
}

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const t = useTranslations("joinPage");
  const inviteCodeParam = params?.inviteCode;
  const inviteCode = typeof inviteCodeParam === "string" ? inviteCodeParam : "";

  const [joining, setJoining] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [preview, setPreview] = useState<JoinClassPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace(
        `/login?next=${encodeURIComponent(`/join/${inviteCode}`)}`,
      );
    }
  }, [inviteCode, loading, router, user]);

  useEffect(() => {
    if (!user || !inviteCode) {
      return;
    }

    let cancelled = false;

    async function loadPreview() {
      setPreviewLoading(true);
      setError(null);

      try {
        const nextPreview = await getJoinClassPreview(inviteCode);
        if (!cancelled) {
          setPreview(nextPreview);
        }
      } catch (err) {
        if (cancelled) {
          return;
        }

        setPreview(null);

        if (err instanceof ApiError) {
          switch (err.code) {
            case "INVITE_CODE_NOT_FOUND":
              setError(t("invalidInviteCode"));
              break;
            case "SCHOOL_MISMATCH":
              setError(t("schoolMismatch"));
              break;
            default:
              setError(err.message);
          }
        } else {
          setError(t("loadPreviewFailed"));
        }
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [inviteCode, t, user]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  const displayName = user?.nickname || user?.email || "";
  const isAlreadyMember = preview?.status === "ALREADY_MEMBER";
  const isSchoolMismatch = preview?.status === "SCHOOL_MISMATCH";

  async function handlePrimaryAction() {
    if (!user) return;

    if (preview?.status === "ALREADY_MEMBER") {
      router.replace(`/classes/${preview.id}`);
      return;
    }

    if (!inviteCode || !preview || isSchoolMismatch) {
      return;
    }

    setJoining(true);
    setError(null);

    try {
      const cls = await joinClass(inviteCode);
      router.replace(`/classes/${cls.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        switch (err.code) {
          case "INVITE_CODE_NOT_FOUND":
            setError(t("invalidInviteCode"));
            break;
          case "ALREADY_MEMBER":
            setPreview((current) =>
              current ? { ...current, status: "ALREADY_MEMBER" } : current,
            );
            setError(null);
            break;
          case "SCHOOL_MISMATCH":
            setPreview((current) =>
              current ? { ...current, status: "SCHOOL_MISMATCH" } : current,
            );
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

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-6 sm:py-8">
      <div className="absolute top-4 right-4">
        <LocaleSwitcher />
      </div>

      <Card className="w-full max-w-lg shadow-sm">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-serif">{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {previewLoading ? (
            <div className="rounded-lg border border-border bg-surface-subtle px-4 py-5 text-sm text-muted-foreground">
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t("loadingPreview")}</span>
              </div>
            </div>
          ) : preview ? (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div
                className="h-2 w-full"
                style={{ backgroundColor: preview.color }}
              />
              <div className="space-y-4 p-4">
                <div className="space-y-1 text-left">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/10"
                      style={{ backgroundColor: preview.color }}
                    />
                    <p className="text-lg font-semibold leading-tight">
                      {preview.name}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {preview.description ?? t("descriptionFallback")}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border bg-surface-subtle p-3 text-left">
                    <p className="text-xs text-muted-foreground">
                      {t("schoolLabel")}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <School className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {preview.schoolName ?? t("schoolOpenToAll")}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-surface-subtle p-3 text-left">
                    <p className="text-xs text-muted-foreground">
                      {t("memberCountLabel")}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-sm font-medium">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {t("memberCountValue", { count: preview.memberCount })}
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2 text-left">
                  <p className="text-xs text-muted-foreground">
                    {t("inviteCodeLabel")}
                  </p>
                  <code className="block rounded-md border border-border bg-surface-subtle px-4 py-2.5 text-center font-mono text-base tracking-widest">
                    {preview.inviteCode}
                  </code>
                </div>
              </div>
            </div>
          ) : null}

          {displayName && (
            <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <LogIn className="h-3.5 w-3.5" />
              <span>{t("joiningAs", { name: displayName })}</span>
            </div>
          )}

          {preview && isAlreadyMember ? (
            <PreviewBanner tone="success">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{t("alreadyJoinedHint")}</span>
              </div>
            </PreviewBanner>
          ) : null}

          {preview && isSchoolMismatch ? (
            <PreviewBanner tone="warning">{t("schoolMismatch")}</PreviewBanner>
          ) : null}

          {preview && !isAlreadyMember && !isSchoolMismatch ? (
            <PreviewBanner tone="default">
              <div className="flex items-start gap-2">
                <span
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full border border-black/10"
                  style={{ backgroundColor: preview.color }}
                />
                <span>{t("reviewHint")}</span>
              </div>
            </PreviewBanner>
          ) : null}

          {error ? <PreviewBanner tone="warning">{error}</PreviewBanner> : null}
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button
            className="w-full"
            onClick={handlePrimaryAction}
            disabled={previewLoading || joining || !preview || isSchoolMismatch}
          >
            {joining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {joining
              ? t("joining")
              : isAlreadyMember
                ? t("openClass")
                : t("join")}
          </Button>

          <Button variant="ghost" className="w-full" asChild>
            <Link href="/">{t("goToDashboard")}</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
