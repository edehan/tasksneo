"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/components/auth-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !token) {
      router.replace("/login");
    }
  }, [loading, token, router]);

  if (loading || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  return <>{children}</>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0 overflow-x-hidden">
          {children}
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  );
}
