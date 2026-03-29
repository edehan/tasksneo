"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import type { AttachmentMeta } from "@/lib/api";

import { AttachmentSidebar } from "./attachment-sidebar";
import { CommentSection } from "./comment-section";

const SIDEBAR_MOBILE_BREAKPOINT = 700;

function useIsNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(
      `(max-width: ${SIDEBAR_MOBILE_BREAKPOINT - 1}px)`,
    );
    const onChange = () => setNarrow(mql.matches);
    mql.addEventListener("change", onChange);
    setNarrow(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return narrow;
}

interface TaskSidebarProps {
  attachments: AttachmentMeta[];
  taskId: string;
  accentColor?: string;
}

export function TaskSidebar({
  attachments,
  taskId,
  accentColor,
}: TaskSidebarProps) {
  const t = useTranslations("taskSidebar");
  const isMobile = useIsNarrow();
  const hasAttachments = attachments.length > 0;

  // Mobile: accordion-style sections with clickable headers
  if (isMobile) {
    return (
      <MobileAccordionSidebar
        attachments={attachments}
        taskId={taskId}
        accentColor={accentColor}
        hasAttachments={hasAttachments}
        labels={{
          attachments: t("attachmentsTab", { count: attachments.length }),
          discussion: t("discussionTab"),
        }}
      />
    );
  }

  // Desktop: vertical split — attachments on top, comments below
  return (
    <div className="flex h-full flex-col">
      {hasAttachments && (
        <div className="shrink-0 border-b border-border">
          <AttachmentSidebar
            attachments={attachments}
            accentColor={accentColor}
          />
        </div>
      )}
      <div className="min-h-0 flex-1">
        <CommentSection taskId={taskId} accentColor={accentColor} />
      </div>
    </div>
  );
}

// ── Mobile accordion ────────────────────────────────────────────────────────

function MobileAccordionSidebar({
  attachments,
  taskId,
  accentColor,
  hasAttachments,
  labels,
}: {
  attachments: AttachmentMeta[];
  taskId: string;
  accentColor?: string;
  hasAttachments: boolean;
  labels: { attachments: string; discussion: string };
}) {
  // "attachments" | "discussion" | null — which section is expanded (null = both collapsed)
  const [expanded, setExpanded] = useState<
    "attachments" | "discussion" | null
  >(null);

  return (
    <div className="flex flex-col">
      {/* Attachments section */}
      {hasAttachments && (
        <div className="border-b border-border">
          <button
            type="button"
            onClick={() =>
              setExpanded(expanded === "attachments" ? null : "attachments")
            }
            className="flex w-full items-center justify-between px-4 py-3"
          >
            <span className="text-label-upper">{labels.attachments}</span>
            <ChevronDown
              size={14}
              strokeWidth={2}
              className={`text-muted-foreground transition-transform duration-150 ${
                expanded === "attachments" ? "rotate-180" : ""
              }`}
            />
          </button>
          {expanded === "attachments" && (
            <AttachmentSidebar
              attachments={attachments}
              accentColor={accentColor}
            />
          )}
        </div>
      )}

      {/* Discussion section */}
      <div className="flex flex-col">
        <button
          type="button"
          onClick={() =>
            setExpanded(expanded === "discussion" ? null : "discussion")
          }
          className="flex w-full items-center justify-between px-4 py-3"
        >
          <span className="text-label-upper">{labels.discussion}</span>
          <ChevronDown
            size={14}
            strokeWidth={2}
            className={`text-muted-foreground transition-transform duration-150 ${
              expanded === "discussion" ? "rotate-180" : ""
            }`}
          />
        </button>
        {expanded === "discussion" && (
          <CommentSection taskId={taskId} accentColor={accentColor} />
        )}
      </div>
    </div>
  );
}
