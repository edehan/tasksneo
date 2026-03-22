"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, createClass } from "@/lib/api";

const PRESET_COLORS = [
  "#5B8C6A",
  "#7B6CB0",
  "#C4785B",
  "#5886A5",
  "#8B7355",
  "#B07090",
  "#6B8FA3",
  "#A0855B",
  "#7A9B6D",
  "#9B6B7A",
];

interface CreateClassDialogProps {
  trigger: React.ReactNode;
  onCreated?: () => void;
}

export function CreateClassDialog({
  trigger,
  onCreated,
}: CreateClassDialogProps) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !name.trim()) return;

    setLoading(true);
    try {
      const cls = await createClass(token, { name: name.trim(), color });
      toast.success(`Created "${cls.name}"`);
      setOpen(false);
      setName("");
      setColor(PRESET_COLORS[0]);
      onCreated?.();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to create class";
      toast.error(message);
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
          setName("");
          setColor(PRESET_COLORS[0]);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="font-serif">
              Create New Class
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="class-name">Class Name</Label>
              <Input
                id="class-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Advanced Mathematics"
                autoFocus
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label>Theme Color</Label>
              <div className="flex flex-wrap gap-2.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="h-8 w-8 rounded-lg transition-all"
                    style={{
                      backgroundColor: c,
                      border:
                        color === c
                          ? "2.5px solid var(--foreground)"
                          : "2.5px solid transparent",
                      transform: color === c ? "scale(1.1)" : "scale(1)",
                    }}
                  />
                ))}
              </div>
            </div>
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
            <Button
              type="submit"
              disabled={loading || !name.trim()}
              style={{ backgroundColor: color }}
              className="text-white hover:opacity-90"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Class
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
