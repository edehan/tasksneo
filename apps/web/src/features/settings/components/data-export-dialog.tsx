"use client";

import { Download, Loader2, Package } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
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
} from "@/components/ui/dialog";
import { formatFileSize } from "@/features/submissions/lib/batch-download";
import {
  computeSummary,
  type ExportProgress,
  type ExportSummary,
  exportFromGatheredData,
  type GatheredData,
  gatherData,
} from "../lib/data-export";

// ─── Types ──────────────────────────────────────────────────────────────────

type Phase = "idle" | "gathering" | "downloading" | "zipping" | "done";

// ─── Component ──────────────────────────────────────────────────────────────

export function DataExportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("dataExportDialog");
  const { user } = useAuth();

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [detail, setDetail] = useState("");
  const [summary, setSummary] = useState<ExportSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const gatheredRef = useRef<GatheredData | null>(null);

  const working = phase !== "idle" && phase !== "done";

  // ── Gather data when dialog opens ────────────────────────────────────

  const loadSummary = useCallback(async () => {
    if (!user) return;
    setLoadingSummary(true);
    try {
      const data = await gatherData(() => {});
      gatheredRef.current = data;
      setSummary(computeSummary(data));
    } catch {
      // Non-critical — user can still attempt export
    } finally {
      setLoadingSummary(false);
    }
  }, [user]);

  useEffect(() => {
    if (open) {
      setPhase("idle");
      setProgress({ completed: 0, total: 0 });
      setDetail("");
      setSummary(null);
      gatheredRef.current = null;
      void loadSummary();
    }
  }, [open, loadSummary]);

  // ── Export handler ────────────────────────────────────────────────────

  async function handleExport() {
    if (!user) return;

    try {
      // If we didn't pre-gather (error during summary), gather now
      let data = gatheredRef.current;
      if (!data) {
        data = await gatherData((p: ExportProgress) => {
          setPhase(p.phase);
          setProgress({ completed: p.completed, total: p.total });
          if (p.detail) setDetail(p.detail);
        });
        gatheredRef.current = data;
      }

      const result = await exportFromGatheredData(
        data,
        (p: ExportProgress) => {
          setPhase(p.phase);
          setProgress({ completed: p.completed, total: p.total });
          if (p.detail) setDetail(p.detail);
        },
      );

      setPhase("done");

      if (result.skippedCount > 0) {
        toast.warning(t("toast.skippedFiles", { count: result.skippedCount }));
      }
      toast.success(t("toast.exportComplete"));

      setTimeout(() => onOpenChange(false), 600);
    } catch {
      toast.error(t("toast.exportFailed"));
      setPhase("idle");
    }
  }

  // ── Dialog open change ────────────────────────────────────────────────

  function handleOpenChange(nextOpen: boolean) {
    if (working) return;
    onOpenChange(nextOpen);
  }

  // ── Progress bar ──────────────────────────────────────────────────────

  const progressPct =
    progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {/* ── Summary ──────────────────────────────────────────────── */}
        {phase === "idle" && (
          <div className="space-y-2 rounded-lg border border-border bg-surface-subtle/40 p-4">
            {loadingSummary ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("summary.gathering")}
              </div>
            ) : summary ? (
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>{t("summary.classes", { count: summary.classCount })}</p>
                <p>
                  {t("summary.submissions", {
                    count: summary.submissionCount,
                  })}
                </p>
                <p>{t("summary.tasks", { count: summary.managedTaskCount })}</p>
                {summary.fileCount > 0 && (
                  <p className="pt-1 font-medium text-foreground">
                    {t("summary.files", { count: summary.fileCount })}
                    {summary.estimatedBytes > 0 &&
                      ` · ${formatFileSize(summary.estimatedBytes)}`}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("summary.ready")}
              </p>
            )}
          </div>
        )}

        {/* ── Progress ─────────────────────────────────────────────── */}
        {working && (
          <div className="space-y-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{
                  width: `${phase === "zipping" ? 100 : phase === "gathering" ? Math.round((progress.completed / Math.max(progress.total, 1)) * 30) : 30 + Math.round((progressPct / 100) * 70)}%`,
                }}
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

        {/* ── Footer ───────────────────────────────────────────────── */}
        <DialogFooter>
          {phase === "idle" && (
            <Button
              onClick={() => void handleExport()}
              disabled={loadingSummary}
            >
              <Download className="h-4 w-4" />
              {t("actions.startExport")}
            </Button>
          )}
          {working && (
            <Button disabled>
              <Package className="h-4 w-4 animate-pulse" />
              {t("actions.processing")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
