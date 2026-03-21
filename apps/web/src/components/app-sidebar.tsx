"use client";

import {
  BookOpen,
  Home,
  LogOut,
  Moon,
  Plus,
  Sun,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { ClassColorBadge } from "@/components/class-color-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { JoinClassDialog } from "@/features/classes/components/join-class-dialog";
import type { ClassSummary } from "@/lib/api";
import { listClasses } from "@/lib/api";

export function AppSidebar() {
  const { token, user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadClasses = useCallback(async () => {
    if (!token) return;
    try {
      const data = await listClasses(token);
      setClasses(data);
    } catch {
      // Silently fail — sidebar is non-critical
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  const personalClass = classes.find((c) => c.isPersonal);
  const sharedClasses = classes.filter((c) => !c.isPersonal);

  const displayName = user?.nickname || user?.email || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <Sidebar className="w-[260px]">
      {/* User row */}
      <SidebarHeader className="px-4 py-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback
              className="text-xs font-semibold text-white"
              style={{
                background: `linear-gradient(135deg, var(--class-accent), color-mix(in oklch, var(--class-accent), #000 20%))`,
              }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col leading-none min-w-0">
            <span className="text-sm font-semibold truncate">
              {user?.nickname || user?.email}
            </span>
            {user?.nickname && (
              <span className="text-xs text-muted-foreground truncate mt-0.5">
                {user.email}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        {/* Home */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={
                    pathname === "/dashboard" ||
                    pathname.startsWith("/dashboard/")
                  }
                  className="data-[active=true]:bg-[color-mix(in_oklch,var(--class-accent),transparent_88%)] data-[active=true]:text-[var(--class-accent)] data-[active=true]:font-semibold"
                >
                  <Link href="/dashboard">
                    <Home className="h-[18px] w-[18px]" />
                    <span>Home</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Personal Space */}
        {personalClass && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === `/classes/${personalClass.id}`}
                    className="data-[active=true]:bg-[color-mix(in_oklch,var(--class-accent),transparent_88%)] data-[active=true]:text-[var(--class-accent)] data-[active=true]:font-semibold"
                  >
                    <Link href={`/classes/${personalClass.id}`}>
                      <BookOpen className="h-[18px] w-[18px]" />
                      <span>Personal Space</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarSeparator />

        {/* Classes */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-[0.06em] text-text-muted">
            Joined Classes
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {loading ? (
                <>
                  <SidebarMenuItem>
                    <Skeleton className="h-8 w-full" />
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <Skeleton className="h-8 w-full" />
                  </SidebarMenuItem>
                </>
              ) : sharedClasses.length === 0 ? (
                <SidebarMenuItem>
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    No classes yet
                  </div>
                </SidebarMenuItem>
              ) : (
                sharedClasses.map((cls) => (
                  <SidebarMenuItem key={cls.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname.startsWith(`/classes/${cls.id}`)}
                      className="data-[active=true]:bg-[color-mix(in_oklch,var(--class-accent),transparent_88%)] data-[active=true]:text-[var(--class-accent)] data-[active=true]:font-semibold"
                    >
                      <Link href={`/classes/${cls.id}`}>
                        <ClassColorBadge color={cls.color} />
                        <span className="truncate">{cls.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer: Join + Create */}
      <SidebarFooter className="p-4">
        <div className="flex gap-2">
          <JoinClassDialog
            trigger={
              <Button
                className="flex-1 font-semibold text-white"
                style={{
                  backgroundColor: "var(--class-accent)",
                  boxShadow: "0 3px 12px color-mix(in oklch, var(--class-accent), transparent 60%)",
                }}
              >
                <UserPlus className="h-4 w-4 mr-1.5" />
                Join Class
              </Button>
            }
            onJoined={() => void loadClasses()}
          />
          <Button
            variant="outline"
            className="flex-1 text-muted-foreground"
            onClick={() => router.push("/classes/new")}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Create
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
