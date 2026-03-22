"use client";

import {
  BookOpen,
  Home,
  LogOut,
  Moon,
  Plus,
  Settings,
  Sun,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { CreateClassDialog } from "@/components/create-class-dialog";
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
    <Sidebar>
      {/* User row with theme toggle */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-3 px-2 py-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 flex-1 min-w-0 rounded-lg hover:bg-sidebar-accent p-1 -m-1 transition-colors">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="text-xs font-medium">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0 text-left">
                      <span className="text-sm font-medium truncate">
                        {displayName}
                      </span>
                      {user?.nickname && user.email && (
                        <span className="text-xs text-muted-foreground truncate">
                          {user.email}
                        </span>
                      )}
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="bottom"
                  align="start"
                  className="w-56"
                >
                  <DropdownMenuItem
                    onClick={() => router.push("/settings/profile")}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {/* Inline dark mode toggle */}
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
                title={theme === "dark" ? "Light mode" : "Dark mode"}
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </button>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        {/* Homepage */}
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
                >
                  <Link href="/dashboard">
                    <Home className="h-4 w-4" />
                    <span>Homepage</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Personal Space */}
        {personalClass && (
          <>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === `/classes/${personalClass.id}`}
                    >
                      <Link href={`/classes/${personalClass.id}`}>
                        <BookOpen className="h-4 w-4" />
                        <span>Personal Space</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        <SidebarSeparator />

        {/* Joined classes */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-label-upper">
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
                    >
                      <Link href={`/classes/${cls.id}`}>
                        <span
                          className="h-2 w-2 shrink-0 rounded-sm"
                          style={{ backgroundColor: cls.color || "#8B7355" }}
                        />
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

      {/* Bottom buttons: Join Class + Create */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex gap-2">
              <JoinClassDialog
                trigger={
                  <SidebarMenuButton className="flex-1 bg-class-accent text-class-accent-foreground hover:opacity-90">
                    <UserPlus className="h-4 w-4" />
                    <span>Join Class</span>
                  </SidebarMenuButton>
                }
                onJoined={() => void loadClasses()}
              />
              <CreateClassDialog
                trigger={
                  <SidebarMenuButton className="shrink-0 w-auto px-3">
                    <Plus className="h-4 w-4" />
                    <span>Create</span>
                  </SidebarMenuButton>
                }
                onCreated={() => void loadClasses()}
              />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
