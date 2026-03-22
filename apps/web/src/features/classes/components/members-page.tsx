"use client";

import { Loader2, Shield, ShieldCheck, Crown, LogOut } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ClassSummary, ClassMember } from "@/lib/api";
import {
  ApiError,
  getClass,
  listMembers,
  updateMemberRole,
  removeMember,
  transferOwnership,
} from "@/lib/api";

function getRoleBadge(role: ClassMember["role"]) {
  switch (role) {
    case "OWNER":
      return (
        <Badge variant="default" className="gap-1">
          <Crown className="h-3 w-3" />
          Owner
        </Badge>
      );
    case "ADMIN":
      return (
        <Badge variant="secondary" className="gap-1">
          <ShieldCheck className="h-3 w-3" />
          Admin
        </Badge>
      );
    case "MEMBER":
      return (
        <Badge variant="outline" className="gap-1">
          <Shield className="h-3 w-3" />
          Member
        </Badge>
      );
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function MembersPage() {
  const params = useParams();
  const { token, user } = useAuth();
  const classId = params?.classId as string;

  const [cls, setCls] = useState<ClassSummary | null>(null);
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Transfer ownership dialog
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<string>("");
  const [transferring, setTransferring] = useState(false);

  const loadData = useCallback(async () => {
    if (!token || !classId) return;
    try {
      const [classData, memberList] = await Promise.all([
        getClass(token, classId),
        listMembers(token, classId),
      ]);
      setCls(classData);
      setMembers(memberList);
    } catch {
      toast.error("Failed to load members");
    } finally {
      setLoading(false);
    }
  }, [token, classId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const myRole = cls?.myRole;
  const isOwner = myRole === "OWNER";
  const isAdmin = myRole === "OWNER" || myRole === "ADMIN";

  async function handleRoleChange(
    memberId: string,
    newRole: "ADMIN" | "MEMBER",
  ) {
    if (!token || !classId) return;
    setActionLoading(memberId);
    try {
      await updateMemberRole(token, classId, memberId, newRole);
      toast.success(`Role updated to ${newRole.toLowerCase()}`);
      await loadData();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to update role";
      toast.error(message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRemove(memberId: string, memberName: string) {
    if (!token || !classId) return;
    setActionLoading(memberId);
    try {
      await removeMember(token, classId, memberId);
      toast.success(`${memberName} removed from class`);
      await loadData();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to remove member";
      toast.error(message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleLeave() {
    if (!token || !classId || !user) return;
    setActionLoading(user.id);
    try {
      await removeMember(token, classId, user.id);
      toast.success("You left the class");
      window.location.href = "/dashboard";
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to leave class";
      toast.error(message);
      setActionLoading(null);
    }
  }

  async function handleTransfer() {
    if (!token || !classId || !transferTarget) return;
    setTransferring(true);
    try {
      await transferOwnership(token, classId, transferTarget);
      toast.success("Ownership transferred");
      setTransferOpen(false);
      setTransferTarget("");
      await loadData();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to transfer ownership";
      toast.error(message);
    } finally {
      setTransferring(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-[960px] mx-auto">
        <div className="h-8 w-32 bg-muted animate-pulse rounded mb-8" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!cls) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Class not found.</p>
      </div>
    );
  }

  const transferCandidates = members.filter(
    (m) => m.userId !== user?.id && m.role !== "OWNER",
  );

  return (
    <div className="p-8 max-w-[960px] mx-auto">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-display mb-1">Members</h1>
          <p className="text-muted-foreground">
            {members.length} member{members.length !== 1 ? "s" : ""} in{" "}
            {cls.name}
          </p>
        </div>
        {isOwner && (
          <Button
            variant="outline"
            onClick={() => setTransferOpen(true)}
            disabled={transferCandidates.length === 0}
          >
            Transfer Ownership
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const displayName = member.nickname || member.email;
              const initials = displayName.slice(0, 2).toUpperCase();
              const isMe = member.userId === user?.id;
              const isMemberLoading = actionLoading === member.userId;

              return (
                <TableRow key={member.userId}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs font-medium">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {displayName}
                          {isMe && (
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              (you)
                            </span>
                          )}
                        </div>
                        {member.nickname && (
                          <div className="text-xs text-muted-foreground truncate">
                            {member.email}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getRoleBadge(member.role)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(member.joinedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isMemberLoading && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}

                      {/* Current user: Leave option (unless OWNER) */}
                      {isMe && !isOwner && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={isMemberLoading}
                            >
                              <LogOut className="mr-1 h-3.5 w-3.5" />
                              Leave
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Leave &quot;{cls.name}&quot;?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                You will lose access to this class and its
                                tasks. You can rejoin later with an invite code.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={handleLeave}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Leave Class
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}

                      {/* Owner viewing an ADMIN */}
                      {!isMe && isOwner && member.role === "ADMIN" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleRoleChange(member.userId, "MEMBER")
                            }
                            disabled={isMemberLoading}
                          >
                            Demote
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                disabled={isMemberLoading}
                              >
                                Remove
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Remove {displayName}?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This person will lose access to the class
                                  immediately. They can rejoin with an invite
                                  code.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    handleRemove(member.userId, displayName)
                                  }
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}

                      {/* Owner or Admin viewing a MEMBER */}
                      {!isMe &&
                        isAdmin &&
                        member.role === "MEMBER" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleRoleChange(member.userId, "ADMIN")
                              }
                              disabled={isMemberLoading}
                            >
                              Promote
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  disabled={isMemberLoading}
                                >
                                  Remove
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Remove {displayName}?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This person will lose access to the class
                                    immediately. They can rejoin with an invite
                                    code.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() =>
                                      handleRemove(member.userId, displayName)
                                    }
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Remove
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Transfer Ownership Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">
              Transfer Ownership
            </DialogTitle>
            <DialogDescription>
              Select a member to transfer ownership of &quot;{cls.name}&quot; to.
              You will be demoted to Admin after the transfer.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="mb-2 block">New Owner</Label>
            <Select value={transferTarget} onValueChange={setTransferTarget}>
              <SelectTrigger>
                <SelectValue placeholder="Select a member" />
              </SelectTrigger>
              <SelectContent>
                {transferCandidates.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.nickname || m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setTransferOpen(false);
                setTransferTarget("");
              }}
              disabled={transferring}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleTransfer}
              disabled={!transferTarget || transferring}
            >
              {transferring && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Transfer Ownership
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
