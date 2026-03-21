export function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDateTimeLong(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function formatDateShort(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });
}

export function daysBetween(a: Date | string, b: Date | string) {
  const aDate = a instanceof Date ? a : new Date(a);
  const bDate = b instanceof Date ? b : new Date(b);
  return (bDate.getTime() - aDate.getTime()) / (1000 * 60 * 60 * 24);
}

export function isOverdue(dueAt?: string | null, now = new Date()) {
  if (!dueAt) return false;
  const dueDate = new Date(dueAt);
  if (Number.isNaN(dueDate.getTime())) return false;
  return dueDate.getTime() < now.getTime();
}

export function pickTaskStartAt(
  startAt?: string | null,
  createdAt?: string | null,
) {
  return startAt ?? createdAt ?? null;
}

export function filesizeLabel(sizeBytes?: number | null) {
  if (!sizeBytes || sizeBytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let size = sizeBytes;
  let idx = 0;

  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }

  const precision = idx === 0 ? 0 : 1;
  return `${size.toFixed(precision)} ${units[idx]}`;
}
