"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { ClassSummary } from "@/lib/api";
import {
  ApiError,
  updatePassword,
  deleteAccount,
  listClasses,
} from "@/lib/api";

export default function AccountPage() {
  const { token, user, logout } = useAuth();
  const router = useRouter();

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Delete account
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Check ownership
  const [ownedClasses, setOwnedClasses] = useState<ClassSummary[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);

  const checkOwnership = useCallback(async () => {
    if (!token) return;
    try {
      const classes = await listClasses(token);
      const owned = classes.filter(
        (c) => c.myRole === "OWNER" && !c.isPersonal,
      );
      setOwnedClasses(owned);
    } catch {
      // Non-critical
    } finally {
      setLoadingClasses(false);
    }
  }, [token]);

  useEffect(() => {
    void checkOwnership();
  }, [checkOwnership]);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setChangingPassword(true);
    try {
      await updatePassword(token, currentPassword, newPassword);
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to change password";
      toast.error(message);
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleDeleteAccount() {
    if (!token) return;
    setDeleting(true);
    try {
      await deleteAccount(token);
      toast.success("Account deleted");
      logout();
      router.push("/login");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to delete account";
      toast.error(message);
      setDeleting(false);
    }
  }

  if (!user) {
    return null;
  }

  const canDelete = ownedClasses.length === 0;
  const passwordFormValid =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    confirmPassword.length > 0;

  return (
    <div className="space-y-8">
      {/* Change Password */}
      <section className="space-y-5">
        <h2 className="text-heading-md">Change Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              disabled={changingPassword}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              disabled={changingPassword}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              disabled={changingPassword}
              autoComplete="new-password"
            />
            {confirmPassword.length > 0 &&
              newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">
                  Passwords do not match
                </p>
              )}
          </div>
          <Button
            type="submit"
            disabled={changingPassword || !passwordFormValid}
          >
            {changingPassword && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Update Password
          </Button>
        </form>
      </section>

      <Separator />

      {/* Danger Zone */}
      <section className="rounded-lg border-2 border-destructive/30 p-6">
        <h2 className="text-heading-md text-destructive mb-2">Danger Zone</h2>

        {loadingClasses ? (
          <div className="h-8 bg-muted animate-pulse rounded" />
        ) : !canDelete ? (
          <div className="flex items-start gap-3 rounded-md bg-destructive/5 p-4">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">
                Cannot delete account
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                You are the owner of{" "}
                {ownedClasses.length === 1
                  ? `"${ownedClasses[0].name}"`
                  : `${ownedClasses.length} classes`}
                . Transfer ownership or delete those classes before deleting
                your account.
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Permanently delete your account and all associated data. This
              action cannot be undone.
            </p>
            <AlertDialog
              open={deleteDialogOpen}
              onOpenChange={(open) => {
                setDeleteDialogOpen(open);
                if (!open) setDeleteConfirmEmail("");
              }}
            >
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Delete Account</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete your account, remove you from
                    all classes, and delete all your submissions. This cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-2">
                  <Label htmlFor="delete-confirm-email" className="mb-2 block">
                    Type <span className="font-mono font-medium">{user.email}</span> to
                    confirm
                  </Label>
                  <Input
                    id="delete-confirm-email"
                    value={deleteConfirmEmail}
                    onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                    placeholder={user.email}
                    disabled={deleting}
                    autoComplete="off"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>
                    Cancel
                  </AlertDialogCancel>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={
                      deleting || deleteConfirmEmail !== user.email
                    }
                  >
                    {deleting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Delete Account
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </section>
    </div>
  );
}
