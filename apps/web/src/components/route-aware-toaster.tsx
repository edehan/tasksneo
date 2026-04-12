"use client";

import { usePathname } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";

export function RouteAwareToaster() {
  const pathname = usePathname();
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  return (
    <Toaster richColors position={isAdminRoute ? "top-center" : "top-right"} />
  );
}
