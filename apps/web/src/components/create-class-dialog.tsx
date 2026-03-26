"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "next-intl";
import { ApiError, createClass, listSchools, type School } from "@/lib/api";

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
  const { token, user } = useAuth();
  const t = useTranslations("createClassDialog");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [restrictSchool, setRestrictSchool] = useState(false);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [schools, setSchools] = useState<School[]>([]);

  // Load schools when school restriction is toggled on
  useEffect(() => {
    if (!restrictSchool) return;
    if (schools.length > 0) return;
    listSchools()
      .then(setSchools)
      .catch(() => {
        // Silently fail — user can still create without restriction
      });
  }, [restrictSchool, schools.length]);

  // When restriction is toggled on, default to user's school
  useEffect(() => {
    if (restrictSchool && !selectedSchoolId && user?.schoolId) {
      setSelectedSchoolId(user.schoolId);
    }
  }, [restrictSchool, selectedSchoolId, user?.schoolId]);

  function resetForm() {
    setName("");
    setColor(PRESET_COLORS[0]);
    setRestrictSchool(false);
    setSelectedSchoolId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !name.trim()) return;

    setLoading(true);
    try {
      const cls = await createClass(token, {
        name: name.trim(),
        color,
        schoolId: restrictSchool && selectedSchoolId ? selectedSchoolId : undefined,
      });
      toast.success(t("createdToast", { name: cls.name }));
      setOpen(false);
      resetForm();
      onCreated?.();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("failedCreate");
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
        if (!v) resetForm();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="font-serif">
              {t("title")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="class-name">{t("className")}</Label>
              <Input
                id="class-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("classNamePlaceholder")}
                autoFocus
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("themeColor")}</Label>
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
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="restrict-school"
                  checked={restrictSchool}
                  onCheckedChange={(v) => {
                    setRestrictSchool(v === true);
                    if (!v) setSelectedSchoolId(null);
                  }}
                  disabled={loading}
                />
                <Label htmlFor="restrict-school" className="text-sm font-normal">
                  {t("restrictSchool")}
                </Label>
              </div>
              {restrictSchool && (
                <Select
                  value={selectedSchoolId ?? ""}
                  onValueChange={setSelectedSchoolId}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectSchool")} />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
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
            <Button
              type="submit"
              disabled={loading || !name.trim()}
              style={{ backgroundColor: color }}
              className="text-white hover:opacity-90"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("createClass")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
