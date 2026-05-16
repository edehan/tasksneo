"use client";

import { CalendarIcon, ChevronDown, ChevronUp, X } from "lucide-react";
import * as React from "react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  calendarDateToZonedDateTime,
  formatZonedDateTime,
  getCalendarDateInTimeZone,
  getZonedDateTimeParts,
  normalizeTimeZone,
  zonedDateTimeToDate,
} from "@/lib/timezone";
import { cn } from "@/lib/utils";

interface DateTimePickerProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  timeZone?: string;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// ── Scroll column for hours or minutes ──────────────────────────────────────

const ITEM_H = 36;
const VISIBLE = 5;

interface ScrollColumnProps {
  count: number;
  selected: number;
  onSelect: (value: number) => void;
  step?: number;
}

function ScrollColumn({
  count,
  selected,
  onSelect,
  step = 1,
}: ScrollColumnProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const items = Array.from(
    { length: Math.ceil(count / step) },
    (_, i) => i * step,
  );
  const selectedIndex = items.indexOf(selected);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container || selectedIndex < 0) return;
    const targetTop = selectedIndex * ITEM_H - Math.floor(VISIBLE / 2) * ITEM_H;
    container.scrollTop = Math.max(0, targetTop);
  }, [selectedIndex]);

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    e.stopPropagation();
    const direction = e.deltaY > 0 ? 1 : -1;
    const currentIdx = selectedIndex >= 0 ? selectedIndex : 0;
    const nextIdx = Math.max(
      0,
      Math.min(items.length - 1, currentIdx + direction),
    );
    onSelect(items[nextIdx]);
  }

  function nudge(direction: 1 | -1) {
    const currentIdx = selectedIndex >= 0 ? selectedIndex : 0;
    const nextIdx = Math.max(
      0,
      Math.min(items.length - 1, currentIdx + direction),
    );
    onSelect(items[nextIdx]);
  }

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => nudge(-1)}
        className="flex h-7 w-full items-center justify-center rounded text-muted-foreground/60 transition-colors hover:text-foreground"
      >
        <ChevronUp size={14} strokeWidth={2} />
      </button>
      <div
        ref={containerRef}
        onWheel={handleWheel}
        className="overflow-hidden"
        style={{ height: VISIBLE * ITEM_H, width: 56 }}
      >
        <div className="flex flex-col">
          {items.map((val) => {
            const isSelected = val === selected;
            return (
              <button
                key={val}
                type="button"
                onClick={() => onSelect(val)}
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-lg text-sm font-medium transition-colors",
                  isSelected
                    ? "bg-foreground text-background"
                    : "text-foreground/50 hover:text-foreground",
                )}
                style={{ height: ITEM_H }}
              >
                {pad(val)}
              </button>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        onClick={() => nudge(1)}
        className="flex h-7 w-full items-center justify-center rounded text-muted-foreground/60 transition-colors hover:text-foreground"
      >
        <ChevronDown size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

// ── DateTimePicker ──────────────────────────────────────────────────────────

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick date & time",
  disabled = false,
  className,
  timeZone,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const zone = normalizeTimeZone(timeZone);
  const selectedCalendarDate = value
    ? getCalendarDateInTimeZone(value, zone)
    : undefined;
  const zonedParts = value ? getZonedDateTimeParts(value, zone) : null;

  const hours = zonedParts?.hour ?? 0;
  const minutes = zonedParts?.minute ?? 0;
  function getBaseParts(): ReturnType<typeof getZonedDateTimeParts> {
    return zonedParts ?? getZonedDateTimeParts(new Date(), zone);
  }

  function handleDateSelect(day: Date | undefined) {
    if (!day) {
      onChange(undefined);
      return;
    }

    onChange(
      calendarDateToZonedDateTime(day, zone, {
        hour: zonedParts?.hour ?? 23,
        minute: zonedParts?.minute ?? 59,
      }),
    );
  }

  function handleHourSelect(h: number) {
    const parts = getBaseParts();
    onChange(zonedDateTimeToDate({ ...parts, hour: h }, zone));
  }

  function handleMinuteSelect(m: number) {
    const parts = getBaseParts();
    onChange(zonedDateTimeToDate({ ...parts, minute: m }, zone));
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(undefined);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            {value ? formatZonedDateTime(value, zone) : placeholder}
          </span>
          {value && !disabled && (
            // biome-ignore lint/a11y/useKeyWithClickEvents: clear button
            // biome-ignore lint/a11y/useSemanticElements: clear button
            <span
              role="button"
              tabIndex={-1}
              onClick={handleClear}
              className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="flex w-auto items-stretch p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedCalendarDate}
          onSelect={handleDateSelect}
          defaultMonth={selectedCalendarDate}
          today={getCalendarDateInTimeZone(new Date(), zone)}
          cellSize="1.8rem"
        />
        {/* Time picker */}
        <div className="flex flex-col border-l border-border">
          <div className="px-4 pt-3 pb-1 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Time
          </div>
          <div className="flex flex-1 items-start justify-center gap-1 px-3 pb-2">
            <ScrollColumn
              count={24}
              selected={hours}
              onSelect={handleHourSelect}
            />
            <div
              className="flex items-center text-sm font-medium text-muted-foreground"
              style={{ height: VISIBLE * ITEM_H }}
            >
              :
            </div>
            <ScrollColumn
              count={60}
              selected={minutes}
              onSelect={handleMinuteSelect}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
