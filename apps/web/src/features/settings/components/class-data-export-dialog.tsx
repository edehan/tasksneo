"use client";

import { Download, Loader2, Package } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ClassSummary } from "@/lib/api";
import { listClasses } from "@/lib/api";
import {
  type ClassExportProgress,
  exportClassData,
} from "../lib/class-data-export";

type Phase = "idle" | "loading" | "gathering" | "downloading" | "zipping";

export function ClassDataExportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("classDataExportDialog");
  const { user } = useAuth();

  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [detail, setDetail] = useState("");

  const working =
    phase === "loading" ||
    phase === "gathering" ||
    phase === "downloading" ||
    phase === "zipping";
  const exporting =
    phase === "gathering" || phase === "downloading" || phase === "zipping";

  const selectedClasses = useMemo(
    () => classes.filter((cls) => selected.has(cls.id)),
    [classes, selected],
  );
  const allSelected = classes.length > 0 && selected.size === classes.length;

  const loadClasses = useCallback(async () => {
    if (!user) return;
    setPhase("loading");
    setDetail("");
    setProgress({ completed: 0, total: 0 });
    try {
      const allClasses = await listClasses();
      const managedClasses = allClasses.filter(
        (cls) =>
          !cls.isPersonal && (cls.myRole === "OWNER" || cls.myRole === "ADMIN"),
      );
      setClasses(managedClasses);
      setSelected(new Set(managedClasses.map((cls) => cls.id)));
      setPhase("idle");
    } catch {
      toast.error(t("toast.loadFailed"));
      setClasses([]);
      setSelected(new Set());
      setPhase("idle");
    }
  }, [t, user]);

  useEffect(() => {
    if (!open) return;
    setClasses([]);
    setSelected(new Set());
    void loadClasses();
  }, [open, loadClasses]);

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(classes.map((cls) => cls.id)));
    }
  }

  function toggleClass(classId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) {
        next.delete(classId);
      } else {
        next.add(classId);
      }
      return next;
    });
  }

  async function handleExport() {
    if (!user || selectedClasses.length === 0) return;

    try {
      const result = await exportClassData(
        selectedClasses,
        (p: ClassExportProgress) => {
          setPhase(p.phase);
          setProgress({ completed: p.completed, total: p.total });
          if (p.detail) setDetail(p.detail);
        },
      );

      if (result.skippedCount > 0) {
        toast.warning(t("toast.skippedFiles", { count: result.skippedCount }));
      }
      toast.success(t("toast.exportComplete"));
      setPhase("idle");
      setTimeout(() => onOpenChange(false), 600);
    } catch {
      toast.error(t("toast.exportFailed"));
      setPhase("idle");
      setProgress({ completed: 0, total: 0 });
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (exporting) return;
    onOpenChange(nextOpen);
  }

  const progressPct =
    progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;
  const progressWidth =
    phase === "zipping"
      ? 100
      : phase === "gathering"
        ? Math.max(5, Math.round((progressPct / 100) * 40))
        : 40 + Math.round((progressPct / 100) * 60);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif">{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {phase === "loading" ? (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-subtle/40 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("loading")}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <Checkbox
                id="select-all-classes"
                checked={allSelected}
                disabled={exporting || classes.length === 0}
                onCheckedChange={toggleAll}
              />
              <label
                htmlFor="select-all-classes"
                className="text-[13px] font-medium text-foreground"
              >
                {t("selectAll", { count: classes.length })}
              </label>
            </div>

            <ScrollArea className="max-h-[260px]">
              <div className="space-y-1 pr-3">
                {classes.map((cls) => (
                  // biome-ignore lint/a11y/noLabelWithoutControl: label wraps Checkbox component
                  <label
                    key={cls.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 transition-colors hover:bg-secondary"
                  >
                    <Checkbox
                      checked={selected.has(cls.id)}
                      disabled={exporting}
                      onCheckedChange={() => toggleClass(cls.id)}
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                      {cls.name}
                    </span>
                    <span className="shrink-0 text-[12px] text-muted-foreground">
                      {t("memberCountHint", { count: cls.memberCount })}
                    </span>
                  </label>
                ))}

                {classes.length === 0 && (
                  <p className="py-6 text-center text-[13px] text-muted-foreground">
                    {t("noClasses")}
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {exporting && (
          <div className="space-y-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progressWidth}%` }}
              />
            </div>
            <p className="text-[12px] text-muted-foreground">
              {phase === "gathering"
                ? detail || t("progress.gathering")
                : phase === "downloading"
                  ? t("progress.downloading", {
                      completed: progress.completed,
                      total: progress.total,
                    })
                  : t("progress.generatingZip")}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            onClick={() => void handleExport()}
            disabled={working || selectedClasses.length === 0}
          >
            {exporting ? (
              <Package className="h-4 w-4 animate-pulse" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exporting
              ? t("actions.processing")
              : t("actions.exportSelected", { count: selectedClasses.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
