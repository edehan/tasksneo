"use client";

import {
  Bold,
  Code2,
  Heading,
  ImageIcon,
  Italic,
  Link2,
  ListOrdered,
  Minus,
  Quote,
} from "lucide-react";
import { useTranslations } from "next-intl";

// ─── Types ───────────────────────────────────────────────────────────────────

interface EditorToolbarProps {
  onInsert: (before: string, after?: string) => void;
  onImageUpload?: () => void;
}

// ─── Toolbar config ──────────────────────────────────────────────────────────

interface ToolbarItem {
  type: "button";
  labelKey: string;
  icon: React.ReactNode;
  before: string;
  after?: string;
}

interface ToolbarSeparator {
  type: "separator";
}

type ToolbarEntry = ToolbarItem | ToolbarSeparator;

const TOOLBAR_ITEMS: ToolbarEntry[] = [
  {
    type: "button",
    labelKey: "bold",
    icon: <Bold size={15} strokeWidth={2} />,
    before: "**",
    after: "**",
  },
  {
    type: "button",
    labelKey: "italic",
    icon: <Italic size={15} strokeWidth={2} />,
    before: "*",
    after: "*",
  },
  {
    type: "button",
    labelKey: "heading",
    icon: <Heading size={15} strokeWidth={2} />,
    before: "## ",
  },
  { type: "separator" },
  {
    type: "button",
    labelKey: "code",
    icon: <Code2 size={15} strokeWidth={2} />,
    before: "`",
    after: "`",
  },
  {
    type: "button",
    labelKey: "quote",
    icon: <Quote size={15} strokeWidth={2} />,
    before: "> ",
  },
  {
    type: "button",
    labelKey: "orderedList",
    icon: <ListOrdered size={15} strokeWidth={2} />,
    before: "1. ",
  },
  {
    type: "button",
    labelKey: "divider",
    icon: <Minus size={15} strokeWidth={2} />,
    before: "---\n",
  },
  { type: "separator" },
  {
    type: "button",
    labelKey: "image",
    icon: <ImageIcon size={15} strokeWidth={2} />,
    before: "![alt](",
    after: ")",
  },
  {
    type: "button",
    labelKey: "link",
    icon: <Link2 size={15} strokeWidth={2} />,
    before: "[text](",
    after: ")",
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function EditorToolbar({ onInsert, onImageUpload }: EditorToolbarProps) {
  const t = useTranslations("editorToolbar");

  return (
    <div className="min-w-0 overflow-x-auto border-b border-border">
      <div className="flex min-w-max items-center gap-0.5 px-4 py-2">
        {TOOLBAR_ITEMS.map((item, i) => {
          if (item.type === "separator") {
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder
              <div
                key={`sep-${i}`}
                className="mx-1.5 h-[18px] w-px shrink-0 bg-border"
              />
            );
          }

          const handleClick =
            item.labelKey === "image" && onImageUpload
              ? onImageUpload
              : () => onInsert(item.before, item.after);

          return (
            <button
              key={item.labelKey}
              type="button"
              onClick={handleClick}
              title={t(item.labelKey)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] bg-transparent text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-[var(--class-accent)]"
            >
              {item.icon}
            </button>
          );
        })}
      </div>
    </div>
  );
}
