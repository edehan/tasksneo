"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { ApiError, confirmEmailChange, getMe } from "@/lib/api";

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const router = useRouter();
  const { logout, updateUser } = useAuth();
  const t = useTranslations("settingsVerifyEmail");

  const [status, setStatus] = useState<
    "loading" | "success" | "email-bound" | "error"
  >("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setErrorMessage(t("missingTokenOrNotSignedIn"));
      setStatus("error");
      return;
    }

    confirmEmailChange(token)
      .then(async () => {
        // Refresh user data to reflect new email
        const updated = await getMe();
        updateUser(updated);
        setStatus("success");
        toast.success(t("emailAddressUpdated"));
      })
      .catch((err) => {
        if (
          err instanceof ApiError &&
          err.code === "EMAIL_BOUND_TO_OTHER_ACCOUNT"
        ) {
          setStatus("email-bound");
          return;
        }

        setErrorMessage(
          err instanceof Error ? err.message : t("verificationFailed"),
        );
        setStatus("error");
      });
  }, [token, updateUser, t]);

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        <p className="text-sm text-muted-foreground">{t("verifyingEmail")}</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <XCircle className="h-12 w-12 text-destructive" />
        <div>
          <h2 className="text-lg font-serif font-semibold">
            {t("verificationFailed")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{errorMessage}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push("/settings/profile")}
        >
          {t("backToProfile")}
        </Button>
      </div>
    );
  }

  if (status === "email-bound") {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <XCircle className="h-12 w-12 text-destructive" />
        <div>
          <h2 className="text-lg font-serif font-semibold">
            {t("emailAlreadyBound")}
          </h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {t("emailAlreadyBoundDescription")}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/settings/profile")}
          >
            {t("backToProfile")}
          </Button>
          <Button onClick={() => void logout()}>{t("signOutAndSignIn")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <CheckCircle2 className="h-12 w-12 text-green-600" />
      <div>
        <h2 className="text-lg font-serif font-semibold">
          {t("emailUpdated")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("emailChangedSuccessfully")}
        </p>
      </div>
      <Button
        variant="outline"
        onClick={() => router.push("/settings/profile")}
      >
        {t("backToProfile")}
      </Button>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        </div>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  );
}
