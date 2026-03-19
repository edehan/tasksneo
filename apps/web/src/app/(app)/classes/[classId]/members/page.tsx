"use client";

import { Loader2, Shield, ShieldOff, UserMinus, UserX } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { useAuth } from "@/components/auth-provider";
import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ClassMember, ClassSummary } from "@/lib/api";
import {
  ApiError,
  getClass,
  listMembers,
  removeMember,
  transferOwnership,
  updateMemberRole,
} from "@/lib/api";

const roleBadgeStyles: Record<string, string> = {
  OWNER: "bg-status-warning/10 text-status-warning border-transparent",
  ADMIN: "bg-status-info/10 text-status-info border-transparent",
  MEMBER: "bg-secondary text-secondary-foreground border-transparent",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function MembersPage() {
  const { token, user } = useAuth();
  const params = useParams<{ classId: string }>();
  const router = useRouter();
  const classId = params.classId;

  const [cls, setCls] = useState<ClassSummary | null>(null);
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Transfer dialog
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [transferring, setTransferring] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [classData, memberData] = await Promise.all([
        getClass(token, classId),
        listMembers(token, classId),
      ]);
      setCls(classData);
      setMembers(memberData);
    } catch {
      toast.error("Failed to load members");
    } finally {
      setLoading(false);
    }
  }, [token, classId]);

  useEffect(() => {
    void load();
  }, [load]);

  const myRole = cls?.myRole;
  const isOwner = myRole === "OWNER";

  async function handleRoleChange(userId: string, newRole: "ADMIN" | "MEMBER") {
    if (!token) return;
    setActionLoading(userId);
    try {
      await updateMemberRole(token, classId, userId, newRole);
      toast.success("Role updated");
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to update role",
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRemove(userId: string) {
    if (!token) return;
    setActionLoading(userId);
    try {
      await removeMember(token, classId, userId);
      toast.success("Member removed");
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to remove member",
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleLeave() {
    if (!token || !user) return;
    setActionLoading(user.id);
    try {
      await removeMember(token, classId, user.id);
      toast.success("You left the class");
      router.push("/classes");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to leave class",
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleTransfer() {
    if (!token || !transferTarget) return;
    setTransferring(true);
    try {
      await transferOwnership(token, classId, transferTarget);
      toast.success("Ownership transferred. You are now an admin.");
      setTransferOpen(false);
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to transfer ownership",
      );
    } finally {
      setTransferring(false);
    }
  }

  const otherMembers = members.filter((m) => m.userId !== user?.id);

  return (
    <>
      <AppHeader title="Members" />
      <div className="mx-auto max-w-240 p-6 space-y-6">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-60 w-full" />
          </div>
        ) : !cls ? (
          <p className="text-muted-foreground">Class not found.</p>
        ) : (
          <>
            <PageHeader
              title={`${cls.name} — Members`}
              description={`${members.length} member${members.length !== 1 ? "s" : ""}`}
            >
              {/* Leave / Transfer */}
              {isOwner ? (
                <>
                  <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTransferOpen(true)}
                    >
                      Transfer ownership
                    </Button>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Transfer ownership</DialogTitle>
                        <DialogDescription>
                          Select a member to become the new owner. You will
                          become an admin.
                        </DialogDescription>
                      </DialogHeader>
                      <Select
                        value={transferTarget}
                        onValueChange={setTransferTarget}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select new owner" />
                        </SelectTrigger>
                        <SelectContent>
                          {otherMembers.map((m) => (
                            <SelectItem key={m.userId} value={m.userId}>
                              {m.nickname || m.email} ({m.role})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <DialogFooter>
                        <Button
                          variant="ghost"
                          onClick={() => setTransferOpen(false)}
                          disabled={transferring}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleTransfer}
                          disabled={transferring || !transferTarget}
                        >
                          {transferring && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Transfer
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button variant="ghost" size="sm" disabled>
                          <UserMinus className="mr-2 h-4 w-4" />
                          Leave
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Transfer ownership before leaving
                    </TooltipContent>
                  </Tooltip>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLeave}
                  disabled={actionLoading === user?.id}
                >
                  <UserMinus className="mr-2 h-4 w-4" />
                  Leave class
                </Button>
              )}
            </PageHeader>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead className="w-24">Role</TableHead>
                    <TableHead className="w-32">Joined</TableHead>
                    {(isOwner || myRole === "ADMIN") && (
                      <TableHead className="w-32" />
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => {
                    const isMe = member.userId === user?.id;
                    const displayName = member.nickname || member.email;
                    const initials = displayName.slice(0, 2).toUpperCase();
                    const isLoading = actionLoading === member.userId;

                    return (
                      <TableRow key={member.userId}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">
                                {displayName}
                                {isMe && (
                                  <span className="ml-1 text-muted-foreground">
                                    (you)
                                  </span>
                                )}
                              </p>
                              {member.nickname && (
                                <p className="text-xs text-muted-foreground">
                                  {member.email}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={roleBadgeStyles[member.role] ?? ""}
                          >
                            {member.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(member.joinedAt)}
                        </TableCell>
                        {(isOwner || myRole === "ADMIN") && (
                          <TableCell>
                            {isMe || member.role === "OWNER" ? null : (
                              <div className="flex items-center gap-1">
                                {isOwner && member.role === "MEMBER" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      handleRoleChange(member.userId, "ADMIN")
                                    }
                                    disabled={isLoading}
                                  >
                                    <Shield className="h-4 w-4" />
                                  </Button>
                                )}
                                {isOwner && member.role === "ADMIN" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      handleRoleChange(member.userId, "MEMBER")
                                    }
                                    disabled={isLoading}
                                  >
                                    <ShieldOff className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  onClick={() => handleRemove(member.userId)}
                                  disabled={isLoading}
                                >
                                  <UserX className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
