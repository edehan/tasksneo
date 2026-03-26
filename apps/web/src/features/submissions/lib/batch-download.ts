import JSZip from "jszip";
import { downloadFileBlob } from "@/lib/api";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DownloadTask {
  fileKey: string;
  fileName: string;
  folderPath: string;
}

export interface DownloadResult {
  task: DownloadTask;
  blob: Blob | null;
  error: string | null;
}

export interface ZipEntry {
  folderName: string;
  files: Array<{ name: string; blob: Blob }>;
  contentMd: string | null;
}

type ProgressCallback = (completed: number, total: number) => void;

// ─── Concurrent download pool ───────────────────────────────────────────────

export async function downloadAllWithConcurrency(
  token: string,
  tasks: DownloadTask[],
  concurrency: number,
  onProgress: ProgressCallback,
): Promise<DownloadResult[]> {
  const results: DownloadResult[] = [];
  let completed = 0;
  let nextIndex = 0;

  async function runNext(): Promise<void> {
    while (nextIndex < tasks.length) {
      const idx = nextIndex++;
      const task = tasks[idx];
      try {
        const blob = await downloadFileBlob(token, task.fileKey);
        results[idx] = { task, blob, error: null };
      } catch (err) {
        results[idx] = {
          task,
          blob: null,
          error: err instanceof Error ? err.message : "Download failed",
        };
      }
      completed++;
      onProgress(completed, tasks.length);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => runNext(),
  );
  await Promise.all(workers);

  return results;
}

// ─── Zip builder ────────────────────────────────────────────────────────────

export async function buildZip(entries: ZipEntry[]): Promise<Blob> {
  const zip = new JSZip();

  for (const entry of entries) {
    const folder = zip.folder(entry.folderName);
    if (!folder) continue;

    for (const file of entry.files) {
      folder.file(file.name, file.blob);
    }

    if (entry.contentMd) {
      folder.file("content.md", entry.contentMd);
    }
  }

  return zip.generateAsync({ type: "blob" });
}

// ─── Tag-based naming ───────────────────────────────────────────────────────

export interface NameTag {
  id: string;
  label: string;
}

export const FOLDER_TAGS: NameTag[] = [
  { id: "nickname", label: "Nickname" },
  { id: "studentId", label: "Student ID" },
  { id: "email", label: "Email" },
];

export const ZIP_TAGS: NameTag[] = [
  { id: "taskTitle", label: "Task" },
  { id: "className", label: "Class" },
  { id: "YYYY", label: "Year" },
  { id: "MM", label: "Month" },
];

const STORAGE_KEY_FOLDER = "taskflow:download:folderTags";
const STORAGE_KEY_ZIP = "taskflow:download:zipTags";

export function loadTagOrder(key: string, defaults: NameTag[]): string[] {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored) as string[];
      // Validate: only keep IDs that still exist in defaults
      const validIds = new Set(defaults.map((t) => t.id));
      const filtered = parsed.filter((id) => validIds.has(id));
      if (filtered.length > 0) return filtered;
    }
  } catch {
    // ignore
  }
  return defaults.map((t) => t.id);
}

export function saveTagOrder(key: string, order: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(order));
  } catch {
    // ignore
  }
}

export function loadFolderTagOrder(): string[] {
  return loadTagOrder(STORAGE_KEY_FOLDER, FOLDER_TAGS);
}

export function saveFolderTagOrder(order: string[]): void {
  saveTagOrder(STORAGE_KEY_FOLDER, order);
}

export function loadZipTagOrder(): string[] {
  return loadTagOrder(STORAGE_KEY_ZIP, ZIP_TAGS);
}

export function saveZipTagOrder(order: string[]): void {
  saveTagOrder(STORAGE_KEY_ZIP, order);
}

export function buildNameFromTags(
  tagIds: string[],
  vars: Record<string, string>,
  separator: string,
): string {
  const parts = tagIds
    .map((id) => vars[id] ?? "")
    .filter((v) => v.length > 0);
  return parts.join(separator) || "download";
}

export function deduplicateFolderNames(names: string[]): string[] {
  const counts = new Map<string, number>();
  return names.map((name) => {
    const count = counts.get(name) ?? 0;
    counts.set(name, count + 1);
    return count === 0 ? name : `${name}_${count + 1}`;
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
