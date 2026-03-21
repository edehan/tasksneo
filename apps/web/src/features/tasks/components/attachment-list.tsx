"use client";

import { Download } from "lucide-react";

import type { AttachmentMeta } from "@/lib/api";

function getFileColor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "#c45c5c";
  if (["doc", "docx"].includes(ext)) return "#5886A5";
  if (["xls", "xlsx", "csv"].includes(ext)) return "#5B8C6A";
  if (["ppt", "pptx"].includes(ext)) return "#C4785B";
  if (["zip", "rar", "7z"].includes(ext)) return "#8B7355";
  if (["py", "js", "ts", "html", "css"].includes(ext)) return "#7B6CB0";
  if (["mp4", "mov", "avi"].includes(ext)) return "#B07090";
  if (["png", "jpg", "jpeg", "gif", "svg"].includes(ext)) return "#6B8FA3";
  return "#8a8078";
}

function getFileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["mp4", "mov", "avi"].includes(ext)) return "\uD83C\uDFAC";
  if (["zip", "rar", "7z"].includes(ext)) return "\uD83D\uDCE6";
  if (["png", "jpg", "jpeg", "gif", "svg"].includes(ext)) return "\uD83D\uDDBC";
  return "\uD83D\uDCC4";
}

function formatSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface AttachmentListProps {
  attachments: AttachmentMeta[];
}

export function AttachmentList({ attachments }: AttachmentListProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="px-4 pb-2.5 pt-4 text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted">
        Attachments ({attachments.length})
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto px-3">
        {attachments.map((att) => {
          const fColor = getFileColor(att.originalName);
          return (
            <div
              key={att.id}
              className="mb-1 flex cursor-pointer items-center gap-2.5 rounded-[9px] p-2.5 transition-colors hover:bg-muted"
            >
              {/* Icon badge */}
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base"
                style={{
                  backgroundColor: `${fColor}15`,
                  color: fColor,
                }}
              >
                {getFileIcon(att.originalName)}
              </div>

              {/* Name + size */}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-medium text-foreground">
                  {att.renamedFile ?? att.originalName}
                </div>
                <div className="mt-0.5 text-[10.5px] text-text-muted">
                  {formatSize(att.sizeBytes)}
                </div>
              </div>

              {/* Download */}
              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors hover:text-white"
                style={{
                  // hover bg handled via CSS in parent
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  el.style.backgroundColor = "var(--class-accent)";
                  el.style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  el.style.backgroundColor = "";
                  el.style.color = "";
                }}
              >
                <Download className="h-3.5 w-3.5" />
              </a>
            </div>
          );
        })}
      </div>

      {/* Download All */}
      <div className="p-3 pt-2.5">
        <button
          type="button"
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-border bg-transparent py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-[var(--class-accent)] hover:text-[var(--class-accent)]"
        >
          <Download className="h-3.5 w-3.5" />
          Download All
        </button>
      </div>
    </div>
  );
}
