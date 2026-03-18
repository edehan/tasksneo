interface ClassColorBadgeProps {
  color: string;
  className?: string;
}

export function ClassColorBadge({ color, className }: ClassColorBadgeProps) {
  return (
    <span
      className={`inline-block h-3 w-3 shrink-0 rounded-full ${className ?? ""}`}
      style={{ backgroundColor: color }}
    />
  );
}
