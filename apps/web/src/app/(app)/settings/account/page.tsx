"use client";

import { AlertTriangle, Download, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { DataExportDialog } from "@/features/settings/components/data-export-dialog";
import type { ClassSummary } from "@/lib/api";
import {
  ApiError,
  deleteAccount,
  listClasses,
  updatePassword } from "@/lib/api";

export default function AccountPage() {
  const { user, logout } = useAuth();
  const t = useTranslations("settingsAccount");
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

  // Data export
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Check ownership
  const [ownedClasses, setOwnedClasses] = useState<ClassSummary[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);

  const checkOwnership = useCallback(async () => {
    try {
      const classes = await listClasses();
      const owned = classes.filter(
        (c) => c.myRole === "OWNER" && !c.isPersonal,
      );
      setOwnedClasses(owned);
    } catch {
      // Non-critical
    } finally {
      setLoadingClasses(false);
    }
  }, []);

  useEffect(() => {
    void checkOwnership();
  }, [checkOwnership]);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error(t("newPasswordsDoNotMatch"));
      return;
    }

    if (newPassword.length < 8) {
      toast.error(t("passwordMinLength"));
      return;
    }

    setChangingPassword(true);
    try {
      await updatePassword(currentPassword, newPassword);
      toast.success(t("passwordUpdated"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("failedChangePassword");
      toast.error(message);
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await deleteAccount();
      toast.success(t("accountDeleted"));
      await logout();
      router.push("/login");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("failedDeleteAccount");
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
        <h2 className="text-heading-md">{t("changePassword")}</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">{t("currentPassword")}</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={t("enterCurrentPassword")}
              disabled={changingPassword}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">{t("newPassword")}</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t("atLeast8Characters")}
              disabled={changingPassword}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t("confirmNewPassword")}</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t("repeatNewPassword")}
              disabled={changingPassword}
              autoComplete="new-password"
            />
            {confirmPassword.length > 0 && newPassword !== confirmPassword && (
              <p className="text-xs text-destructive">
                {t("passwordsDoNotMatch")}
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
            {t("updatePassword")}
          </Button>
        </form>
      </section>

      <Separator />

      {/* Data Export */}
      <section className="space-y-3">
        <h2 className="text-heading-md">{t("dataExport.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("dataExport.description")}
        </p>
        <Button variant="outline" onClick={() => setExportDialogOpen(true)}>
          <Download className="h-4 w-4" />
          {t("dataExport.exportButton")}
        </Button>
      </section>

      <DataExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
      />

      <Separator />

      {/* Danger Zone */}
      <section className="rounded-lg border-2 border-destructive/30 p-6">
        <h2 className="text-heading-md text-destructive mb-2">
          {t("dangerZone")}
        </h2>

        {loadingClasses ? (
          <div className="h-8 bg-muted animate-pulse rounded" />
        ) : !canDelete ? (
          <div className="flex items-start gap-3 rounded-md bg-destructive/5 p-4">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">
                {t("cannotDeleteAccount")}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("ownerOfPrefix")}{" "}
                {ownedClasses.length === 1
                  ? `"${ownedClasses[0].name}"`
                  : t("classesCount", { count: ownedClasses.length })}
                {t("ownerOfSuffix")}
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {t("permanentDeleteWarning")}
            </p>
            <AlertDialog
              open={deleteDialogOpen}
              onOpenChange={(open) => {
                setDeleteDialogOpen(open);
                if (!open) setDeleteConfirmEmail("");
              }}
            >
              <AlertDialogTrigger asChild>
                <Button variant="destructive">{t("deleteAccount")}</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("deleteYourAccountTitle")}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("deleteYourAccountDescription")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-2">
                  <Label htmlFor="delete-confirm-email" className="mb-2 block">
                    {t("typeToConfirmPrefix")}{" "}
                    <span className="font-mono font-medium">{user.email}</span>{" "}
                    {t("typeToConfirmSuffix")}
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
                    {t("cancel")}
                  </AlertDialogCancel>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={deleting || deleteConfirmEmail !== user.email}
                  >
                    {deleting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {t("deleteAccount")}
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
