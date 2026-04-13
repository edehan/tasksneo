"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, joinClass } from "@/lib/api";

interface JoinClassDialogProps {
  trigger: React.ReactNode;
  onJoined?: () => void;
}

export function JoinClassDialog({ trigger, onJoined }: JoinClassDialogProps) {
  const { user } = useAuth();
  const t = useTranslations("joinClassDialog");
  const [open, setOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !inviteCode.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const cls = await joinClass(inviteCode.trim());
      toast.success(t("joinedToast", { name: cls.name }));
      setOpen(false);
      setInviteCode("");
      onJoined?.();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t("failedJoin"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setInviteCode("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="invite-code">{t("inviteCode")}</Label>
            <Input
              id="invite-code"
              value={inviteCode}
              onChange={(e) => {
                setInviteCode(e.target.value);
                setError(null);
              }}
              placeholder={t("inviteCodePlaceholder")}
              className="mt-2 font-mono"
              autoFocus
              disabled={loading}
            />
            {error && <p className="mt-2 text-sm text-status-error">{error}</p>}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={loading || !inviteCode.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("join")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
