"use client";

import { Loader2 } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, joinClass } from "@/lib/api";

interface JoinClassDialogProps {
  trigger: React.ReactNode;
  onJoined?: () => void;
}

export function JoinClassDialog({ trigger, onJoined }: JoinClassDialogProps) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !inviteCode.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const cls = await joinClass(token, inviteCode.trim());
      toast.success(`Joined "${cls.name}"`);
      setOpen(false);
      setInviteCode("");
      onJoined?.();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to join class. Please try again.");
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
            <DialogTitle>Join a class</DialogTitle>
            <DialogDescription>
              Enter the invite code shared by your teacher or classmates.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="invite-code">Invite code</Label>
            <Input
              id="invite-code"
              value={inviteCode}
              onChange={(e) => {
                setInviteCode(e.target.value);
                setError(null);
              }}
              placeholder="e.g. abc123xyz"
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
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !inviteCode.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Join
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
