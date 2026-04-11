"use client";

import {
  BookOpen,
  FileSearch,
  FolderKanban,
  type LucideIcon,
  MessageSquare,
  Paperclip,
  Search,
  UserRound,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  type SearchDocument,
  type SearchResultKind,
  useGlobalSearch,
} from "@/features/search/global-search";
import { cn } from "@/lib/utils";

const GROUP_ORDER: SearchResultKind[] = [
  "task",
  "comment",
  "submission",
  "class",
  "attachment",
  "member",
];

const RESULT_ICONS: Record<SearchResultKind, LucideIcon> = {
  task: FileSearch,
  comment: MessageSquare,
  submission: BookOpen,
  class: FolderKanban,
  attachment: Paperclip,
  member: UserRound,
};

export function GlobalSearchInput() {
  const t = useTranslations("globalSearch");
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const { query, setQuery, results, status, open, setOpen } = useGlobalSearch();
  const [activeIndex, setActiveIndex] = useState(0);

  const groupedResults = useMemo(
    () =>
      GROUP_ORDER.map((kind) => ({
        kind,
        items: results.filter((result) => result.kind === kind),
      })).filter((group) => group.items.length > 0),
    [results],
  );

  useEffect(() => {
    setActiveIndex((current) => {
      if (results.length === 0) return 0;
      return Math.min(current, results.length - 1);
    });
  }, [results.length]);

  useEffect(() => {
    if (!pathname) return;
    setOpen(false);
  }, [pathname, setOpen]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setOpen]);

  function handleSelect(document: SearchDocument) {
    router.push(document.route);
    setOpen(false);
    setQuery("");
  }

  function handleEscape() {
    if (open) {
      setOpen(false);
      return;
    }

    if (query) {
      setQuery("");
    }
  }

  function handleArrow(direction: 1 | -1) {
    if (results.length === 0) return;
    setOpen(true);
    setActiveIndex((current) => {
      const next = current + direction;
      if (next < 0) return results.length - 1;
      if (next >= results.length) return 0;
      return next;
    });
  }

  const statusLabel = (() => {
    if (status.isSearching) return t("status.searching");
    if (status.phase === "loading") return t("status.loading");
    if (status.phase === "enriching") return t("status.indexingMore");
    if (status.phase === "error") return t("status.failed");
    return null;
  })();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative w-[min(23.625rem,calc(100vw-8rem))] max-w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                handleArrow(1);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                handleArrow(-1);
              } else if (event.key === "Enter") {
                if (results[activeIndex]) {
                  event.preventDefault();
                  handleSelect(results[activeIndex]);
                }
              } else if (event.key === "Escape") {
                event.preventDefault();
                handleEscape();
              }
            }}
            placeholder={t("placeholder")}
            className="h-10 rounded-xl border-border/70 bg-background pl-9 pr-20 shadow-sm"
            aria-label={t("placeholder")}
          />
          <div className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:flex">
            <span>{t("shortcut.modifier")}</span>
            <span>K</span>
          </div>
        </div>
      </PopoverAnchor>

      <PopoverContent
        align="center"
        sideOffset={8}
        className="w-[min(42rem,calc(100vw-2rem))] p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">
              {t("resultsTitle")}
            </p>
            {statusLabel && (
              <span className="text-xs text-muted-foreground">
                {statusLabel}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("shortcutHint")}
          </p>
        </div>

        <div className="max-h-[28rem] overflow-y-auto">
          {!query.trim() ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t("emptyIdle")}
            </div>
          ) : groupedResults.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {status.phase === "loading" || status.isSearching
                ? t("emptyLoading")
                : t("emptyNoResults")}
            </div>
          ) : (
            <div className="py-2">
              {groupedResults.map((group) => (
                <div key={group.kind} className="pb-1">
                  <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {t(`sections.${group.kind}`)}
                  </div>
                  <div>
                    {group.items.map((item) => {
                      const resultIndex = results.findIndex(
                        (result) => result.id === item.id,
                      );
                      return (
                        <SearchResultRow
                          key={item.id}
                          item={item}
                          active={resultIndex === activeIndex}
                          onSelect={handleSelect}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {status.phase === "enriching" && query.trim() && (
          <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            {t("status.mayImprove")}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function SearchResultRow({
  item,
  active,
  onSelect,
}: {
  item: SearchDocument;
  active: boolean;
  onSelect: (item: SearchDocument) => void;
}) {
  const Icon = RESULT_ICONS[item.kind];
  const snippet = item.content || item.subtitle;

  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onSelect(item)}
      className={cn(
        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
        active ? "bg-surface-subtle" : "hover:bg-surface-subtle/70",
      )}
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">
          {item.title}
        </div>
        {item.subtitle && (
          <div className="truncate text-xs text-muted-foreground">
            {item.subtitle}
          </div>
        )}
        {snippet && (
          <div className="mt-1 line-clamp-2 text-xs text-text-muted-soft">
            {snippet}
          </div>
        )}
      </div>
    </button>
  );
}
