"use client";

import { Download, FileText } from "lucide-react";
import type { AttachmentMeta } from "@/lib/api";
import { getFileUrl } from "@/lib/api";

interface AttachmentSidebarProps {
  attachments: AttachmentMeta[];
  accentColor?: string;
  onDownload?: (att: AttachmentMeta) => void;
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

function getExtColor(filename: string): string {
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
  onDownload,
}: AttachmentSidebarProps) {
  const accent = accentColor ?? "var(--class-accent)";

  function handleDownload(att: AttachmentMeta) {
    if (onDownload) {
      onDownload(att);
      return;
    }
    const url = att.url || getFileUrl(att.fileKey);
    const link = document.createElement("a");
    link.href = url;
    link.download = att.originalName;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleDownloadAll() {
    for (const att of attachments) {
      handleDownload(att);
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
                  title={att.originalName}
                >
                  {att.originalName}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {formatFileSize(att.sizeBytes)}
                </p>
              </div>

              {/* Download button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(att);
                }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground transition-colors duration-100 hover:text-white"
                style={{
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ["--hover-bg" as string]: accent,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    accent;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    "";
                }}
                aria-label={`Download ${att.originalName}`}
              >
                <Download size={14} strokeWidth={2} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Download all */}
      {attachments.length > 1 && (
        <button
          type="button"
          onClick={handleDownloadAll}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-transparent px-3 py-2 text-[12.5px] font-medium text-muted-foreground transition-colors duration-100 hover:bg-secondary hover:text-foreground"
        >
          <Download size={14} strokeWidth={2} />
          Download All
        </button>
      )}
    </div>
  );
}
