"use client";

interface TaskContentCardProps {
  title?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

export function TaskContentCard({
  title,
  headerRight,
  children,
}: TaskContentCardProps) {
  return (
    <div className="rounded-xl border bg-card p-5">
      {(title || headerRight) && (
        <div className="mb-4 flex items-center justify-between">
          {title && (
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          )}
          {headerRight}
        </div>
      )}
      {children}
    </div>
  );
}
