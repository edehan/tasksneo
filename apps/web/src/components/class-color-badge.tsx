interface ClassColorBadgeProps {
  color: string;
  className?: string;
}

export function ClassColorBadge({ color, className }: ClassColorBadgeProps) {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-[3px] ${className ?? ""}`}
      style={{ backgroundColor: color }}
    />
  );
}
