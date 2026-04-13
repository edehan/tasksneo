"use client";

import {
  ArrowLeft,
  Crown,
  Loader2,
  LogOut,
  Shield,
  ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow } from "@/components/ui/table";
import { UserAvatar } from "@/components/user-avatar";
import type { ClassMember, ClassSummary } from "@/lib/api";
import {
  ApiError,
  getClass,
  listMembers,
  removeMember,
  transferOwnership,
  updateMemberRole } from "@/lib/api";

function getRoleBadge(
  role: ClassMember["role"],
  t: ReturnType<typeof useTranslations>,
) {
  switch (role) {
    case "OWNER":
      return (
        <Badge variant="default" className="gap-1">
          <Crown className="h-3 w-3" />
          {t("roles.owner")}
        </Badge>
      );
    case "ADMIN":
      return (
        <Badge variant="secondary" className="gap-1">
          <ShieldCheck className="h-3 w-3" />
          {t("roles.admin")}
        </Badge>
      );
    case "MEMBER":
      return (
        <Badge variant="outline" className="gap-1">
          <Shield className="h-3 w-3" />
          {t("roles.member")}
        </Badge>
      );
  }
}

function formatDate(dateStr: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric" }).format(new Date(dateStr));
}

export function MembersPage() {
  const t = useTranslations("classMembers");
  const locale = useLocale();
  const params = useParams();
  const { user } = useAuth();
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
    if (!classId) return;
    try {
      const [classData, memberList] = await Promise.all([
        getClass(classId),
        listMembers(classId),
      ]);
      setCls(classData);
      setMembers(memberList);
    } catch {
      toast.error(t("toast.failedLoadMembers"));
    } finally {
      setLoading(false);
    }
  }, [classId, t]);

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
    if (!classId) return;
    setActionLoading(memberId);
    try {
      await updateMemberRole(classId, memberId, newRole);
      toast.success(
        t("toast.roleUpdated", {
          role: newRole === "ADMIN" ? t("roles.admin") : t("roles.member") }),
      );
      await loadData();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("toast.failedUpdateRole");
      toast.error(message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRemove(memberId: string, memberName: string) {
    if (!classId) return;
    setActionLoading(memberId);
    try {
      await removeMember(classId, memberId);
      toast.success(t("toast.memberRemoved", { name: memberName }));
      await loadData();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("toast.failedRemoveMember");
      toast.error(message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleLeave() {
    if (!classId || !user) return;
    setActionLoading(user.id);
    try {
      await removeMember(classId, user.id);
      toast.success(t("toast.leftClass"));
      window.location.href = "/dashboard";
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("toast.failedLeaveClass");
      toast.error(message);
      setActionLoading(null);
    }
  }

  async function handleTransfer() {
    if (!classId || !transferTarget) return;
    setTransferring(true);
    try {
      await transferOwnership(classId, transferTarget);
      toast.success(t("toast.ownershipTransferred"));
      setTransferOpen(false);
      setTransferTarget("");
      await loadData();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : t("toast.failedTransferOwnership");
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
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder
            <div key={i} className="h-14 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!cls) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">{t("classNotFound")}</p>
      </div>
    );
  }

  const transferCandidates = members.filter(
    (m) => m.userId !== user?.id && m.role !== "OWNER",
  );

  return (
    <div className="p-8 max-w-[960px] mx-auto">
      <Link
        href={`/classes/${classId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground mb-3"
      >
        <ArrowLeft size={14} strokeWidth={2} />
        {t("backToClass", { name: cls.name })}
      </Link>
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-display mb-1">{t("title")}</h1>
          <p className="text-muted-foreground">
            {t("subtitle", { count: members.length, className: cls.name })}
          </p>
        </div>
        {isOwner && (
          <Button
            variant="outline"
            onClick={() => setTransferOpen(true)}
            disabled={transferCandidates.length === 0}
          >
            {t("transferOwnership")}
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">{t("table.member")}</TableHead>
              <TableHead>{t("table.role")}</TableHead>
              <TableHead>{t("table.joined")}</TableHead>
              <TableHead className="text-right">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const displayName = member.nickname || t("user");
              const isMe = member.userId === user?.id;
              const isMemberLoading = actionLoading === member.userId;

              return (
                <TableRow key={member.userId}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        avatarHash={member.avatarHash}
                        name={displayName}
                        className="h-8 w-8"
                        size={64}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {displayName}
                          {isMe && (
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              ({t("you")})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getRoleBadge(member.role, t)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(member.joinedAt, locale)}
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
                              {t("actions.leave")}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {t("dialogs.leave.title", { name: cls.name })}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("dialogs.leave.description")}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>
                                {t("common.cancel")}
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={handleLeave}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {t("dialogs.leave.confirm")}
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
                            {t("actions.demote")}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                disabled={isMemberLoading}
                              >
                                {t("actions.remove")}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {t("dialogs.remove.title", {
                                    name: displayName })}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t("dialogs.remove.description")}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>
                                  {t("common.cancel")}
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    handleRemove(member.userId, displayName)
                                  }
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {t("actions.remove")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}

                      {/* Owner can promote a MEMBER to ADMIN */}
                      {!isMe && isOwner && member.role === "MEMBER" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleRoleChange(member.userId, "ADMIN")
                          }
                          disabled={isMemberLoading}
                        >
                          {t("actions.promote")}
                        </Button>
                      )}

                      {/* Owner or Admin can remove a MEMBER */}
                      {!isMe && isAdmin && member.role === "MEMBER" && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={isMemberLoading}
                            >
                              {t("actions.remove")}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {t("dialogs.remove.title", {
                                  name: displayName })}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("dialogs.remove.description")}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>
                                {t("common.cancel")}
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  handleRemove(member.userId, displayName)
                                }
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {t("actions.remove")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
              {t("transferDialog.title")}
            </DialogTitle>
            <DialogDescription>
              {t("transferDialog.description", { name: cls.name })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="mb-2 block">{t("transferDialog.newOwner")}</Label>
            <Select value={transferTarget} onValueChange={setTransferTarget}>
              <SelectTrigger>
                <SelectValue placeholder={t("transferDialog.selectMember")} />
              </SelectTrigger>
              <SelectContent>
                {transferCandidates.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.nickname || t("user")}
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
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleTransfer}
              disabled={!transferTarget || transferring}
            >
              {transferring && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("transferOwnership")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
