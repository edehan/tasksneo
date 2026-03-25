"use client";

import { Download, FileText, Loader2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import type { AttachmentMeta } from "@/lib/api";
import { ApiError, downloadFile } from "@/lib/api";

interface AttachmentSidebarProps {
  attachments: AttachmentMeta[];
  accentColor?: string;
  onRemove?: (att: AttachmentMeta) => void;
}

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
}: AttachmentSidebarProps) {
  const { token } = useAuth();
  const accent = accentColor ?? "var(--class-accent)";
  const [downloading, setDownloading] = useState<string | null>(null);

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
        err instanceof ApiError ? err.message : "Failed to download file";
      toast.error(message);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="flex h-full flex-col bg-surface-subtle/60 p-4">
      {/* Header */}
      <span className="text-label-upper mb-3">
        Attachments ({attachments.length})
      </span>

      {/* File list */}
      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto">
        {attachments.map((att) => {
          const iconColor = getExtColor(att.originalName);
          const isDownloading = downloading === att.id;
          return (
            <div
              key={att.id}
              className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors duration-100 hover:bg-secondary"
            >
              {/* File icon */}
              <div className="flex shrink-0 items-center justify-center">
                <FileText
                  size={18}
                  strokeWidth={1.8}
                  style={{ color: iconColor }}
                />
              </div>

              {/* Name + size */}
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-[12.5px] font-medium text-foreground"
                  title={att.originalName ?? "Unknown file"}
                >
                  {att.originalName ?? "Unknown file"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {formatFileSize(att.sizeBytes)}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex shrink-0 items-center gap-1">
                {/* Download button */}
                <button
                  type="button"
                  disabled={isDownloading}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDownload(att);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-muted-foreground transition-colors duration-100 hover:text-white disabled:opacity-50"
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
                    <Loader2 size={14} strokeWidth={2} className="animate-spin" />
                  ) : (
                    <Download size={14} strokeWidth={2} />
                  )}
                </button>

                {/* Remove button (only when onRemove is provided) */}
                {onRemove && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(att);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-100 hover:bg-destructive/10 hover:text-destructive"
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
            No files attached yet
          </p>
        )}
      </div>

      {/* Download all */}
      {attachments.length > 1 && (
        <button
          type="button"
          onClick={() => {
            for (const att of attachments) {
              void handleDownload(att);
            }
          }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-transparent px-3 py-2 text-[12.5px] font-medium text-muted-foreground transition-colors duration-100 hover:bg-secondary hover:text-foreground"
        >
          <Download size={14} strokeWidth={2} />
          Download All
        </button>
      )}
    </div>
  );
}
