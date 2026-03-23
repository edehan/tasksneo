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

// ─── Types ───────────────────────────────────────────────────────────────────

interface EditorToolbarProps {
  onInsert: (before: string, after?: string) => void;
  onImageUpload?: () => void;
}

// ─── Toolbar config ──────────────────────────────────────────────────────────

interface ToolbarItem {
  type: "button";
  label: string;
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
    label: "Bold",
    icon: <Bold size={15} strokeWidth={2} />,
    before: "**",
    after: "**",
  },
  {
    type: "button",
    label: "Italic",
    icon: <Italic size={15} strokeWidth={2} />,
    before: "*",
    after: "*",
  },
  {
    type: "button",
    label: "Heading",
    icon: <Heading size={15} strokeWidth={2} />,
    before: "## ",
  },
  { type: "separator" },
  {
    type: "button",
    label: "Code",
    icon: <Code2 size={15} strokeWidth={2} />,
    before: "`",
    after: "`",
  },
  {
    type: "button",
    label: "Quote",
    icon: <Quote size={15} strokeWidth={2} />,
    before: "> ",
  },
  {
    type: "button",
    label: "Ordered List",
    icon: <ListOrdered size={15} strokeWidth={2} />,
    before: "1. ",
  },
  {
    type: "button",
    label: "Divider",
    icon: <Minus size={15} strokeWidth={2} />,
    before: "---\n",
  },
  { type: "separator" },
  {
    type: "button",
    label: "Image",
    icon: <ImageIcon size={15} strokeWidth={2} />,
    before: "![alt](",
    after: ")",
  },
  {
    type: "button",
    label: "Link",
    icon: <Link2 size={15} strokeWidth={2} />,
    before: "[text](",
    after: ")",
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function EditorToolbar({ onInsert, onImageUpload }: EditorToolbarProps) {
  return (
    <div className="flex items-center gap-0.5 border-b border-border px-4 py-2">
      {TOOLBAR_ITEMS.map((item, i) => {
        if (item.type === "separator") {
          return (
            <div
              key={`sep-${i}`}
              className="mx-1.5 h-[18px] w-px bg-border"
            />
          );
        }

        const handleClick =
          item.label === "Image" && onImageUpload
            ? onImageUpload
            : () => onInsert(item.before, item.after);

        return (
          <button
            key={item.label}
            type="button"
            onClick={handleClick}
            title={item.label}
            className="flex h-8 w-8 items-center justify-center rounded-[7px] bg-transparent text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-[var(--class-accent)]"
          >
            {item.icon}
          </button>
        );
      })}
    </div>
  );
}
