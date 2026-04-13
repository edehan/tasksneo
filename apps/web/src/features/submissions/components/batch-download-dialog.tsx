"use client";

import { Download, GripVertical, Package } from "lucide-react";
import { useTranslations } from "next-intl";
import { type DragEvent, useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ClassSummary, SubmissionListRow, TaskDetail } from "@/lib/api";
import {
  buildNameFromTags,
  buildZip,
  type DownloadTask,
  deduplicateFolderNames,
  downloadAllWithConcurrency,
  FOLDER_TAGS,
  formatFileSize,
  loadFolderTagOrder,
  loadZipTagOrder,
  type NameTag,
  saveFolderTagOrder,
  saveZipTagOrder,
  ZIP_TAGS,
  type ZipEntry } from "../lib/batch-download";

// ─── Types ──────────────────────────────────────────────────────────────────

interface BatchDownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: SubmissionListRow[];
  task: TaskDetail;
  cls: ClassSummary;
  accentColor: string;
}

// ─── Drag-and-drop tag composer ─────────────────────────────────────────────

const ZONE_ACTIVE = "active";
const ZONE_POOL = "pool";
type TranslateFn = ReturnType<typeof useTranslations>;

function TagComposer({
  tags,
  order,
  onReorder,
  disabled,
  preview,
  t }: {
  tags: NameTag[];
  order: string[];
  onReorder: (newOrder: string[]) => void;
  disabled: boolean;
  preview: string;
  t: TranslateFn;
}) {
  const tagMap = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const poolIds = useMemo(
    () => tags.filter((t) => !order.includes(t.id)).map((t) => t.id),
    [tags, order],
  );

  // drag state: which tag id is being dragged, from which zone
  const dragId = useRef<string | null>(null);
  const dragSource = useRef<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [overZone, setOverZone] = useState<string | null>(null);

  function onDragStart(e: DragEvent<HTMLDivElement>, id: string, zone: string) {
    dragId.current = id;
    dragSource.current = zone;
    setDragging(id);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragEnd() {
    const id = dragId.current;
    const source = dragSource.current;

    if (id && overZone) {
      if (overZone === ZONE_ACTIVE) {
        // Insert into active at overIdx position
        const newOrder = order.filter((x) => x !== id);
        const insertAt =
          overIdx !== null
            ? Math.min(overIdx, newOrder.length)
            : newOrder.length;
        newOrder.splice(insertAt, 0, id);
        onReorder(newOrder);
      } else if (overZone === ZONE_POOL && source === ZONE_ACTIVE) {
        // Remove from active
        onReorder(order.filter((x) => x !== id));
      }
    }

    dragId.current = null;
    dragSource.current = null;
    setDragging(null);
    setOverIdx(null);
    setOverZone(null);
  }

  function renderTag(id: string, zone: string) {
    const tag = tagMap.get(id);
    if (!tag) return null;
    const isDragging = dragging === id;
    return (
      // biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop tag element
      <div
        key={id}
        draggable={!disabled}
        onDragStart={(e) => onDragStart(e, id, zone)}
        onDragEnd={onDragEnd}
        className={`flex cursor-grab items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[12px] font-medium select-none transition-opacity active:cursor-grabbing ${
          zone === ZONE_ACTIVE
            ? "bg-secondary text-foreground"
            : "bg-transparent text-muted-foreground"
        } ${isDragging ? "opacity-30" : ""} ${disabled ? "cursor-default opacity-60" : ""}`}
      >
        <GripVertical size={11} className="shrink-0 text-muted-foreground/60" />
        {t(`tagLabels.${tag.id}`)}
      </div>
    );
  }

  const showDropHint =
    dragging !== null && overZone === ZONE_ACTIVE && !order.includes(dragging);

  return (
    <div className="space-y-1.5">
      {/* Active zone */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop zone */}
      <div
        className={`flex min-h-[34px] flex-wrap items-center gap-1.5 rounded-md border border-dashed px-2 py-1.5 transition-colors ${
          overZone === ZONE_ACTIVE && dragging
            ? "border-ring bg-secondary/50"
            : "border-border"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setOverZone(ZONE_ACTIVE);
          // Calculate drop position from mouse X relative to children
          const container = e.currentTarget;
          const children = Array.from(container.children) as HTMLElement[];
          let idx = order.length;
          for (let i = 0; i < children.length; i++) {
            const rect = children[i].getBoundingClientRect();
            if (e.clientX < rect.left + rect.width / 2) {
              idx = i;
              break;
            }
          }
          setOverIdx(idx);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setOverZone(null);
            setOverIdx(null);
          }
        }}
      >
        {order.length === 0 && !showDropHint && (
          <span className="text-[11px] text-muted-foreground/60">
            {t("tagComposer.dragTagsHere")}
          </span>
        )}
        {order.map((id, idx) => (
          // biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop reorder target
          <div
            key={id}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOverZone(ZONE_ACTIVE);
              setOverIdx(idx);
            }}
          >
            {renderTag(id, ZONE_ACTIVE)}
          </div>
        ))}
      </div>

      {/* Pool zone — always visible as a drop target */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop zone */}
      <div
        className={`flex min-h-[34px] flex-wrap items-center gap-1.5 rounded-md border border-dashed px-2 py-1.5 transition-colors ${
          overZone === ZONE_POOL && dragging
            ? "border-ring bg-secondary/50"
            : "border-transparent"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setOverZone(ZONE_POOL);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setOverZone(null);
          }
        }}
      >
        {poolIds.length > 0 ? (
          poolIds.map((id) => renderTag(id, ZONE_POOL))
        ) : (
          <span className="text-[11px] text-muted-foreground/50">
            {t("tagComposer.dragHereToRemove")}
          </span>
        )}
      </div>

      {/* Preview */}
      <p className="text-[11px] text-muted-foreground">
        {t("tagComposer.preview")}: <span className="font-mono">{preview}</span>
      </p>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function BatchDownloadDialog({
  open,
  onOpenChange,
  rows,
  task,
  cls,
  accentColor }: BatchDownloadDialogProps) {
  const t = useTranslations("batchDownloadDialog");
  const { token } = useAuth();

  // Filter to eligible rows: submitted with attachments or content
  const eligibleRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.submitted &&
          (r.attachments.length > 0 ||
            (r.submission?.content && r.submission.content.trim().length > 0)),
      ),
    [rows],
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [folderOrder, setFolderOrder] = useState<string[]>(loadFolderTagOrder);
  const [zipOrder, setZipOrder] = useState<string[]>(loadZipTagOrder);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [phase, setPhase] = useState<"idle" | "downloading" | "zipping">(
    "idle",
  );

  // ── Selection handlers ──────────────────────────────────────────────────

  const allSelected =
    eligibleRows.length > 0 && selected.size === eligibleRows.length;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(eligibleRows.map((r) => r.userId)));
    }
  }

  function toggleUser(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  // ── Tag order handlers (persist to localStorage) ────────────────────────

  function handleFolderReorder(newOrder: string[]) {
    setFolderOrder(newOrder);
    saveFolderTagOrder(newOrder);
  }

  function handleZipReorder(newOrder: string[]) {
    setZipOrder(newOrder);
    saveZipTagOrder(newOrder);
  }

  // ── Preview values ────────────────────────────────────────────────────

  const now = new Date();
  const dateVars = useMemo(
    () => ({
      YYYY: String(now.getFullYear()),
      MM: String(now.getMonth() + 1).padStart(2, "0"),
      DD: String(now.getDate()).padStart(2, "0") }),
    [now.getDate, now.getFullYear, now.getMonth],
  );

  const sampleRow = eligibleRows[0];
  const folderPreview = sampleRow
    ? buildNameFromTags(
        folderOrder,
        {
          nickname: sampleRow.nickname ?? t("sampleUser"),
          studentId: sampleRow.studentId ?? "" },
        "_",
      )
    : t("folderPreviewFallback");

  const zipPreview = `${buildNameFromTags(
    zipOrder,
    {
      taskTitle: task.title,
      className: cls.name,
      ...dateVars },
    "_",
  )}.zip`;

  // ── Download handler ──────────────────────────────────────────────────

  const handleDownload = useCallback(async () => {
    if (!token || selected.size === 0) return;

    setDownloading(true);
    setPhase("downloading");

    try {
      const selectedRows = eligibleRows.filter((r) => selected.has(r.userId));

      // Build folder names and deduplicate
      const rawFolderNames = selectedRows.map((r) =>
        buildNameFromTags(
          folderOrder,
          {
            nickname: r.nickname ?? t("sampleUser"),
            studentId: r.studentId ?? "" },
          "_",
        ),
      );
      const folderNames = deduplicateFolderNames(rawFolderNames);

      // Build download tasks for all attachments
      const downloadTasks: DownloadTask[] = [];
      for (let i = 0; i < selectedRows.length; i++) {
        const row = selectedRows[i];
        for (const att of row.attachments) {
          downloadTasks.push({
            fileKey: att.fileKey,
            fileName: att.originalName,
            folderPath: folderNames[i] });
        }
      }

      // Download all files with concurrency
      let results: Awaited<ReturnType<typeof downloadAllWithConcurrency>> = [];
      if (downloadTasks.length > 0) {
        setProgress({ completed: 0, total: downloadTasks.length });
        results = await downloadAllWithConcurrency(
          downloadTasks,
          5,
          (completed, total) => setProgress({ completed, total }),
        );
      }

      // Assemble zip entries
      setPhase("zipping");
      const entries: ZipEntry[] = selectedRows.map((row, i) => {
        const folderName = folderNames[i];
        const folderResults = results.filter(
          (r) => r.task.folderPath === folderName && r.blob,
        );
        return {
          folderName,
          files: folderResults.map((r) => ({
            name: r.task.fileName,
            // biome-ignore lint/style/noNonNullAssertion: blob guaranteed by successful fetch
            blob: r.blob! })),
          contentMd: row.submission?.content ?? null };
      });

      // Count errors
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) {
        toast.warning(t("toast.skippedFiles", { count: errors.length }));
      }

      // Build and trigger download
      const zipBlob = await buildZip(entries);
      const zipName = `${buildNameFromTags(
        zipOrder,
        { taskTitle: task.title, className: cls.name, ...dateVars },
        "-",
      )}.zip`;

      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = zipName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(t("toast.downloadComplete"));
    } catch {
      toast.error(t("toast.failedCreateDownload"));
    } finally {
      setDownloading(false);
      setPhase("idle");
      setProgress({ completed: 0, total: 0 });
    }
  }, [
    selected,
    eligibleRows,
    folderOrder,
    zipOrder,
    task.title,
    cls.name,
    dateVars,
    t,
  ]);

  // ── Reset on open ─────────────────────────────────────────────────────

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setSelected(new Set(eligibleRows.map((r) => r.userId)));
      setFolderOrder(loadFolderTagOrder());
      setZipOrder(loadZipTagOrder());
      setPhase("idle");
      setProgress({ completed: 0, total: 0 });
    }
    if (!downloading) {
      onOpenChange(nextOpen);
    }
  }

  // ── Total size of selected ────────────────────────────────────────────

  const totalSize = useMemo(() => {
    let bytes = 0;
    for (const row of eligibleRows) {
      if (!selected.has(row.userId)) continue;
      for (const att of row.attachments) {
        bytes += att.sizeBytes ?? 0;
      }
    }
    return bytes;
  }, [eligibleRows, selected]);

  // ── Render ────────────────────────────────────────────────────────────

  const progressPct =
    progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif">{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { count: eligibleRows.length })}
          </DialogDescription>
        </DialogHeader>

        {/* ── Student selection ───────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Checkbox
              id="select-all"
              checked={allSelected}
              onCheckedChange={toggleAll}
            />
            <label
              htmlFor="select-all"
              className="text-[13px] font-medium text-foreground"
            >
              {t("selectAll", { count: eligibleRows.length })}
            </label>
            {selected.size > 0 && (
              <span className="ml-auto text-[12px] text-muted-foreground">
                {formatFileSize(totalSize)}
              </span>
            )}
          </div>

          <ScrollArea className="max-h-[240px]">
            <div className="space-y-1 pr-3">
              {eligibleRows.map((row) => (
                // biome-ignore lint/a11y/noLabelWithoutControl: label wraps Checkbox component
                <label
                  key={row.userId}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 transition-colors hover:bg-secondary"
                >
                  <Checkbox
                    checked={selected.has(row.userId)}
                    onCheckedChange={() => toggleUser(row.userId)}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                    {row.nickname ?? row.studentId ?? "Student"}
                  </span>
                  {row.attachments.length > 0 && (
                    <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                      {t("filesCount", { count: row.attachments.length })}
                    </span>
                  )}
                </label>
              ))}

              {eligibleRows.length === 0 && (
                <p className="py-6 text-center text-[13px] text-muted-foreground">
                  {t("noSubmissions")}
                </p>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* ── Naming rules ───────────────────────────────────────── */}
        <div className="space-y-3 border-t border-border pt-3">
          <p className="text-[12px] font-medium text-muted-foreground">
            {t("namingRules")}
          </p>

          <div className="space-y-1">
            <p className="text-[12px] text-muted-foreground">
              {t("folderName")}
            </p>
            <TagComposer
              tags={FOLDER_TAGS}
              order={folderOrder}
              onReorder={handleFolderReorder}
              disabled={downloading}
              preview={folderPreview}
              t={t}
            />
          </div>

          <div className="space-y-1">
            <p className="text-[12px] text-muted-foreground">
              {t("zipFileName")}
            </p>
            <TagComposer
              tags={ZIP_TAGS}
              order={zipOrder}
              onReorder={handleZipReorder}
              disabled={downloading}
              preview={zipPreview}
              t={t}
            />
          </div>
        </div>

        {/* ── Progress bar ───────────────────────────────────────── */}
        {downloading && (
          <div className="space-y-1.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${phase === "zipping" ? 100 : progressPct}%`,
                  backgroundColor: accentColor }}
              />
            </div>
            <p className="text-[12px] text-muted-foreground">
              {phase === "downloading"
                ? t("progress.downloading", {
                    completed: progress.completed,
                    total: progress.total })
                : t("progress.generatingZip")}
            </p>
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────────── */}
        <DialogFooter>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading || selected.size === 0}
            className="flex items-center gap-2 rounded-[10px] px-5 py-2 text-[13px] font-medium text-white transition-colors duration-100 disabled:opacity-50"
            style={{ backgroundColor: accentColor }}
          >
            {downloading ? (
              <Package size={14} strokeWidth={2} className="animate-pulse" />
            ) : (
              <Download size={14} strokeWidth={2} />
            )}
            {downloading
              ? t("actions.processing")
              : t("actions.downloadSelected", { count: selected.size })}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
