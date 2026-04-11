"use client";

import {
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  EyeOff,
  FileText,
  ImagePlus,
  Loader2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import type { AttachmentMeta } from "@/lib/api";
import { ApiError, downloadFile } from "@/lib/api";

interface AttachmentSidebarProps {
  attachments: AttachmentMeta[];
  accentColor?: string;
  onRemove?: (att: AttachmentMeta) => void;
  onToggleVisibility?: (att: AttachmentMeta) => void;
  onInsertImage?: (att: AttachmentMeta) => void;
}

const COLLAPSE_THRESHOLD = 3;

// ─── File extension icon colors ──────────────────────────────────────────────

const EXT_COLORS: Record<string, string> = {
  pdf: "#c45c5c",
  doc: "#5886A5",
  docx: "#5886A5",
  xls: "#5B8C6A",
  xlsx: "#5B8C6A",
  ppt: "#C4785B",
  pptx: "#C4785B",
  zip: "#8B7355",
  rar: "#8B7355",
  "7z": "#8B7355",
  tar: "#8B7355",
  gz: "#8B7355",
  // Code
  js: "#7B6CB0",
  ts: "#7B6CB0",
  jsx: "#7B6CB0",
  tsx: "#7B6CB0",
  py: "#7B6CB0",
  java: "#7B6CB0",
  c: "#7B6CB0",
  cpp: "#7B6CB0",
  rs: "#7B6CB0",
  go: "#7B6CB0",
  html: "#7B6CB0",
  css: "#7B6CB0",
  json: "#7B6CB0",
  // Images
  png: "#6B8FA3",
  jpg: "#6B8FA3",
  jpeg: "#6B8FA3",
  gif: "#6B8FA3",
  svg: "#6B8FA3",
  webp: "#6B8FA3",
};

const DEFAULT_ICON_COLOR = "#8a8078";

function getExtColor(filename: string | undefined): string {
  if (!filename) return DEFAULT_ICON_COLOR;
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXT_COLORS[ext] ?? DEFAULT_ICON_COLOR;
}

function isImageAttachment(att: AttachmentMeta): boolean {
  if (att.mimeType?.toLowerCase().startsWith("image/")) {
    return true;
  }

  const name = att.originalName ?? "";
  const ext = name.split(".").pop()?.toLowerCase();
  return ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp"].includes(
    ext ?? "",
  );
}

// ─── File size formatting ────────────────────────────────────────────────────

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AttachmentSidebar({
  attachments,
  accentColor,
  onRemove,
  onToggleVisibility,
  onInsertImage,
}: AttachmentSidebarProps) {
  const t = useTranslations("attachmentSidebar");
  const { token } = useAuth();
  const accent = accentColor ?? "var(--class-accent)";
  const [downloading, setDownloading] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(
    attachments.length > COLLAPSE_THRESHOLD,
  );

  const canCollapse = attachments.length > COLLAPSE_THRESHOLD;
  const visibleAttachments = collapsed
    ? attachments.slice(0, COLLAPSE_THRESHOLD)
    : attachments;

  async function handleDownload(att: AttachmentMeta) {
    if (!token) return;

    setDownloading(att.id);
    try {
      const blobUrl = await downloadFile(token, att.fileKey);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = att.originalName ?? att.fileKey;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("failedDownloadFile");
      toast.error(message);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="flex flex-col bg-surface-subtle/60 p-4">
      {/* Header */}
      <span className="text-label-upper mb-3">
        {t("attachmentsCount", { count: attachments.length })}
      </span>

      {/* File list */}
      <div className="flex flex-col gap-1.5">
        {visibleAttachments.map((att) => {
          const iconColor = getExtColor(att.originalName);
          const isDownloading = downloading === att.id;
          return (
            <div
              key={att.id}
              className="group flex flex-col gap-2 rounded-lg px-2 py-2 transition-colors duration-100 hover:bg-secondary md:flex-row md:items-center md:gap-2.5 md:py-1.5"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                {/* File icon */}
                <div className="group/icon relative flex h-8 w-8 shrink-0 items-center justify-center md:h-7 md:w-7">
                  <FileText
                    size={18}
                    strokeWidth={1.8}
                    style={{ color: iconColor }}
                    className={
                      onInsertImage && isImageAttachment(att)
                        ? "transition-opacity duration-150 group-hover/icon:opacity-0"
                        : undefined
                    }
                  />
                  {onInsertImage && isImageAttachment(att) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onInsertImage(att);
                      }}
                      className="absolute inset-0 flex items-center justify-center rounded-md bg-secondary text-muted-foreground opacity-0 transition-opacity duration-150 hover:text-foreground group-hover/icon:opacity-100"
                      aria-label={t("insertIntoBody", {
                        name: att.originalName,
                      })}
                      title={t("insertIntoBody", { name: att.originalName })}
                    >
                      <ImagePlus size={14} strokeWidth={2} />
                    </button>
                  )}
                </div>

                {/* Name + size */}
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-[12.5px] font-medium text-foreground"
                    title={att.originalName ?? t("unknownFile")}
                  >
                    {att.originalName ?? t("unknownFile")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatFileSize(att.sizeBytes)}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex shrink-0 items-center justify-end gap-1 pl-[42px] md:pl-0">
                {/* Download button */}
                <button
                  type="button"
                  disabled={isDownloading}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDownload(att);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-muted-foreground transition-colors duration-100 hover:text-white disabled:opacity-50 md:h-7 md:w-7"
                  onMouseEnter={(e) => {
                    if (!isDownloading)
                      (
                        e.currentTarget as HTMLButtonElement
                      ).style.backgroundColor = accent;
                  }}
                  onMouseLeave={(e) => {
                    (
                      e.currentTarget as HTMLButtonElement
                    ).style.backgroundColor = "";
                  }}
                  aria-label={`Download ${att.originalName}`}
                >
                  {isDownloading ? (
                    <Loader2
                      size={14}
                      strokeWidth={2}
                      className="animate-spin"
                    />
                  ) : (
                    <Download size={14} strokeWidth={2} />
                  )}
                </button>

                {onToggleVisibility && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleVisibility(att);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-muted-foreground transition-colors duration-100 hover:text-foreground md:h-7 md:w-7"
                    onMouseEnter={(e) => {
                      (
                        e.currentTarget as HTMLButtonElement
                      ).style.backgroundColor = accent;
                    }}
                    onMouseLeave={(e) => {
                      (
                        e.currentTarget as HTMLButtonElement
                      ).style.backgroundColor = "";
                    }}
                    aria-label={
                      att.isVisible
                        ? t("hideAttachment", { name: att.originalName })
                        : t("showAttachment", { name: att.originalName })
                    }
                    title={
                      att.isVisible
                        ? t("hideAttachment", { name: att.originalName })
                        : t("showAttachment", { name: att.originalName })
                    }
                  >
                    {att.isVisible ? (
                      <Eye size={14} strokeWidth={2} />
                    ) : (
                      <EyeOff size={14} strokeWidth={2} />
                    )}
                  </button>
                )}

                {/* Remove button (only when onRemove is provided) */}
                {onRemove && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(att);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-100 hover:bg-destructive/10 hover:text-destructive md:h-7 md:w-7"
                    aria-label={`Remove ${att.originalName}`}
                  >
                    <X size={14} strokeWidth={2} />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {attachments.length === 0 && (
          <p className="py-4 text-center text-xs italic text-muted-foreground">
            {t("noFilesAttached")}
          </p>
        )}
      </div>

      {/* Collapse toggle */}
      {canCollapse && (
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-[11.5px] font-medium text-muted-foreground transition-colors duration-100 hover:bg-secondary hover:text-foreground"
        >
          {collapsed ? (
            <>
              {t("showAll", { count: attachments.length })}
              <ChevronDown size={13} strokeWidth={2} />
            </>
          ) : (
            <>
              {t("showLess")}
              <ChevronUp size={13} strokeWidth={2} />
            </>
          )}
        </button>
      )}
    </div>
  );
}
