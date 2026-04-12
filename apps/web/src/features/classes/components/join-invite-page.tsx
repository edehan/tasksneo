"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, getClassInvitePreview, joinClass, type ClassInvitePreview } from "@/lib/api";
import { redirectToLogin } from "@/lib/auth-redirect";
import { classPath } from "@/lib/routes";

export function JoinInvitePage() {
  const t = useTranslations("joinInvitePage");
  const params = useParams();
  const router = useRouter();
  const { token, loading: authLoading } = useAuth();
  const inviteCode = useMemo(() => {
    const raw = params?.inviteCode;
    return typeof raw === "string" ? raw : "";
  }, [params?.inviteCode]);

  const [preview, setPreview] = useState<ClassInvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!authLoading && !token) {
      redirectToLogin(router);
    }
  }, [authLoading, router, token]);

  useEffect(() => {
    if (!inviteCode) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    getClassInvitePreview(inviteCode)
      .then((result) => {
        if (!cancelled) {
          setPreview(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreview(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [inviteCode]);

  async function handleJoin() {
    if (!token || !inviteCode) {
      return;
    }

    setJoining(true);

    try {
      const joined = await joinClass(token, inviteCode);
      toast.success(t("joinedSuccess", { name: joined.name }));
      router.replace(classPath(joined));
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.code === "ALREADY_MEMBER" &&
        preview
      ) {
        router.replace(classPath(preview));
        return;
      }

      const message =
        err instanceof ApiError ? err.message : t("failedJoin");
      toast.error(message);
      setJoining(false);
    }
  }

  if (authLoading || loading || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>{t("invalidTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t("invalidDescription")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="mb-3 flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: preview.color }}
            />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("inviteLabel")}
            </span>
          </div>
          <CardTitle className="text-2xl font-serif">{preview.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {preview.description ? (
            <p className="text-sm text-muted-foreground">{preview.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noDescription")}</p>
          )}
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{t("inviteCode")}</span>
              <code className="font-mono text-foreground">{inviteCode}</code>
            </div>
            {preview.schoolName && (
              <div className="mt-3 flex items-center justify-between gap-4">
                <span className="text-muted-foreground">{t("school")}</span>
                <span className="text-foreground">{preview.schoolName}</span>
              </div>
            )}
          </div>
          <Button
            onClick={() => void handleJoin()}
            disabled={joining}
            className="w-full"
            style={{ backgroundColor: preview.color }}
          >
            {joining ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 h-4 w-4" />
            )}
            {joining ? t("joining") : t("joinNow")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
