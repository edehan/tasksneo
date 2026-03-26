"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { confirmEmailChange, getMe } from "@/lib/api";

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const router = useRouter();
  const { token: authToken, updateUser } = useAuth();

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token || !authToken) {
      setErrorMessage("Missing verification token or not signed in.");
      setStatus("error");
      return;
    }

    confirmEmailChange(authToken, token)
      .then(async () => {
        // Refresh user data to reflect new email
        const updated = await getMe(authToken);
        updateUser(updated);
        setStatus("success");
        toast.success("Email address updated");
      })
      .catch((err) => {
        setErrorMessage(
          err instanceof Error ? err.message : "Verification failed",
        );
        setStatus("error");
      });
  }, [token, authToken, updateUser]);

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        <p className="text-sm text-muted-foreground">Verifying your email...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <XCircle className="h-12 w-12 text-destructive" />
        <div>
          <h2 className="text-lg font-serif font-semibold">Verification failed</h2>
          <p className="mt-1 text-sm text-muted-foreground">{errorMessage}</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/settings/profile")}>
          Back to profile
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <CheckCircle2 className="h-12 w-12 text-green-600" />
      <div>
        <h2 className="text-lg font-serif font-semibold">Email updated</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your email address has been changed successfully.
        </p>
      </div>
      <Button variant="outline" onClick={() => router.push("/settings/profile")}>
        Back to profile
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
