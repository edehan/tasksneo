"use client";

import { CalendarIcon, X } from "lucide-react";
import * as React from "react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface DateTimePickerProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateTime(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick date & time",
  disabled = false,
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const timeScrollRef = React.useRef<HTMLDivElement>(null);

  const hours = value ? value.getHours() : 0;
  const minutes = value ? value.getMinutes() : 0;

  // Scroll to the selected time slot when popover opens
  React.useEffect(() => {
    if (open && value && timeScrollRef.current) {
      const slotIndex = hours * 4 + Math.floor(minutes / 15);
      const scrollContainer = timeScrollRef.current.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
      if (scrollContainer) {
        // Each slot is ~32px high + 4px gap
        const scrollTop = Math.max(0, slotIndex * 36 - 72);
        setTimeout(() => {
          scrollContainer.scrollTop = scrollTop;
        }, 50);
      }
    }
  }, [open, value, hours, minutes]);

  function handleDateSelect(day: Date | undefined) {
    if (!day) {
      onChange(undefined);
      return;
    }

    const next = new Date(day);
    if (value) {
      next.setHours(value.getHours(), value.getMinutes(), 0, 0);
    } else {
      next.setHours(23, 59, 0, 0);
    }
    onChange(next);
  }

  function handleTimeSelect(hour: number, minute: number) {
    const next = value ? new Date(value) : new Date();
    next.setHours(hour, minute, 0, 0);
    onChange(next);
    setOpen(false);
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
            {value ? formatDateTime(value) : placeholder}
          </span>
          {value && !disabled && (
            // biome-ignore lint/a11y/useKeyWithClickEvents: clear button with role=button
            // biome-ignore lint/a11y/useSemanticElements: clear button with role=button
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
      <PopoverContent className="flex w-auto items-start p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={handleDateSelect}
          defaultMonth={value}
        />
        <div ref={timeScrollRef} className="border-l border-border">
          <ScrollArea className="h-[300px] w-[100px]">
            <div className="flex flex-col gap-1 p-2">
              {Array.from({ length: 96 }, (_, i) => {
                const h = Math.floor(i / 4);
                const m = (i % 4) * 15;
                const timeStr = `${pad(h)}:${pad(m)}`;
                const isSelected =
                  value &&
                  h === hours &&
                  m <= minutes &&
                  (m + 15 > minutes || m === 45);

                return (
                  <button
                    key={timeStr}
                    type="button"
                    onClick={() => handleTimeSelect(h, m)}
                    className={cn(
                      "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                      isSelected
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    {timeStr}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
