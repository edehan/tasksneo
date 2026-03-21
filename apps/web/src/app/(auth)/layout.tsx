"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/components/auth-provider";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { token, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && token) {
      router.replace("/dashboard");
    }
  }, [loading, token, router]);

  if (loading || token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-12"
      style={{
        background:
          "radial-gradient(circle at top right, color-mix(in srgb, var(--class-accent) 14%, transparent) 0%, transparent 50%), var(--bg)",
      }}
    >
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
