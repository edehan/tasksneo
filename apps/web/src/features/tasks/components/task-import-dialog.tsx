"use client";

import { CalendarClock, Check, Import, Loader2, Paperclip } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ApiError,
  getTaskImportCandidateDetail,
  listTaskImportCandidates,
  type TaskImportCandidate,
  type TaskImportCandidateDetail,
  type TaskImportSort,
} from "@/lib/api";
import { formatDateInTimeZone } from "@/lib/timezone";

interface TaskImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (taskId: string, body: string | null) => Promise<void>;
  importing: boolean;
  timeZone: string;
}

const ALL_CLASSES = "__all__";

function formatTaskTime(iso: string, locale: string, timeZone: string): string {
  try {
    return formatDateInTimeZone(new Date(iso), locale, timeZone, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function TaskImportDialog({
  open,
  onOpenChange,
  onImport,
  importing,
  timeZone,
}: TaskImportDialogProps) {
  const t = useTranslations("postTaskDialog.importTask");
  const locale = useLocale();
  const [tasks, setTasks] = useState<TaskImportCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<TaskImportSort>("updatedAt");
  const [classId, setClassId] = useState(ALL_CLASSES);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] =
    useState<TaskImportCandidateDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    listTaskImportCandidates({ sort })
      .then((items) => {
        setTasks(items);
        setSelectedTaskId((current) =>
          current && items.some((item) => item.id === current) ? current : null,
        );
      })
      .catch((err) => {
        const message = err instanceof ApiError ? err.message : t("failedLoad");
        toast.error(message);
      })
      .finally(() => setLoading(false));
  }, [open, sort, t]);

  useEffect(() => {
    if (!open) {
      setSelectedTaskId(null);
      setSelectedDetail(null);
      setClassId(ALL_CLASSES);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !selectedTaskId) {
      setSelectedDetail(null);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setSelectedDetail(null);
    getTaskImportCandidateDetail(selectedTaskId)
      .then((detail) => {
        if (!cancelled) setSelectedDetail(detail);
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err instanceof ApiError ? err.message : t("failedLoadDetail");
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, selectedTaskId, t]);

  const classOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const task of tasks) {
      options.set(task.classId, task.className ?? t("unknownClass"));
    }
    return Array.from(options, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [tasks, t]);

  const filteredTasks = useMemo(
    () =>
      classId === ALL_CLASSES
        ? tasks
        : tasks.filter((task) => task.classId === classId),
    [classId, tasks],
  );

  const selectedTask =
    filteredTasks.find((task) => task.id === selectedTaskId) ?? null;

  async function handleImport() {
    if (!selectedTaskId || !selectedDetail || importing) return;
    await onImport(selectedTaskId, selectedDetail.body);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2.5 font-serif text-base font-semibold">
            <Import size={17} strokeWidth={2} />
            {t("title")}
          </DialogTitle>
        </DialogHeader>

        <div className="grid max-h-[70vh] min-h-[520px] grid-cols-1 overflow-hidden md:grid-cols-[minmax(0,1fr)_280px]">
          <div className="flex min-h-0 flex-col border-b border-border md:border-b-0 md:border-r">
            <div className="flex flex-col gap-2 border-b border-border p-4 sm:flex-row">
              <Select
                value={classId}
                onValueChange={(value) => {
                  setClassId(value);
                  setSelectedTaskId(null);
                  setSelectedDetail(null);
                }}
              >
                <SelectTrigger className="h-9 rounded-lg sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_CLASSES}>{t("allClasses")}</SelectItem>
                  {classOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={sort}
                onValueChange={(value) => setSort(value as TaskImportSort)}
              >
                <SelectTrigger className="h-9 rounded-lg sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updatedAt">
                    {t("sort.updatedAt")}
                  </SelectItem>
                  <SelectItem value="createdAt">
                    {t("sort.createdAt")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {loading ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <Loader2 size={18} strokeWidth={2} className="animate-spin" />
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                  {t("empty")}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredTasks.map((task) => {
                    const selected = task.id === selectedTaskId;
                    return (
                      <label
                        key={task.id}
                        className={`grid w-full grid-cols-[18px_minmax(0,1fr)] gap-3 rounded-md border px-3 py-2.5 text-left transition-colors ${
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-surface-subtle"
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border ${
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground"
                          }`}
                        >
                          <input
                            type="radio"
                            name="task-import-candidate"
                            value={task.id}
                            checked={selected}
                            onChange={() => setSelectedTaskId(task.id)}
                            className="sr-only"
                          />
                          {selected && <Check size={11} strokeWidth={3} />}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {task.title}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="truncate">{task.className}</span>
                            <span className="inline-flex items-center gap-1">
                              <CalendarClock size={12} strokeWidth={2} />
                              {formatTaskTime(task[sort], locale, timeZone)}
                            </span>
                            {task.attachmentCount > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <Paperclip size={12} strokeWidth={2} />
                                {t("attachments", {
                                  count: task.attachmentCount,
                                })}
                              </span>
                            )}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <aside className="min-h-0 overflow-y-auto bg-surface-subtle/40 p-4">
            {selectedTask ? (
              <div className="space-y-4">
                <div>
                  <p className="text-label-upper mb-2">{t("previewTitle")}</p>
                  <p className="text-sm font-medium text-foreground">
                    {selectedTask.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedTask.className}
                  </p>
                </div>

                <div>
                  <p className="text-label-upper mb-2">
                    {t("attachmentSummary")}
                  </p>
                  {detailLoading ? (
                    <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Loader2
                        size={14}
                        strokeWidth={2}
                        className="animate-spin"
                      />
                      {t("loadingDetail")}
                    </p>
                  ) : selectedDetail &&
                    selectedDetail.attachments.length > 0 ? (
                    <div className="space-y-1.5">
                      {selectedDetail.attachments.map((attachment) => (
                        <p
                          key={attachment.id}
                          className="flex min-w-0 items-center gap-1.5 text-sm text-foreground"
                        >
                          <Paperclip
                            size={14}
                            strokeWidth={2}
                            className="shrink-0"
                          />
                          <span className="truncate">
                            {attachment.originalName}
                          </span>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="inline-flex items-center gap-1.5 text-sm text-foreground">
                      <Paperclip size={14} strokeWidth={2} />
                      {t("attachments", {
                        count: selectedTask.attachmentCount,
                      })}
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-label-upper mb-2">{t("body")}</p>
                  <pre className="max-h-56 whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-xs leading-relaxed text-foreground">
                    {detailLoading
                      ? t("loadingDetail")
                      : selectedDetail?.body?.trim() || t("emptyBody")}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
                {t("selectHint")}
              </div>
            )}
          </aside>
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={importing}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={
              !selectedTaskId || !selectedDetail || detailLoading || importing
            }
          >
            {importing && (
              <Loader2
                size={14}
                strokeWidth={2}
                className="mr-1.5 animate-spin"
              />
            )}
            {t("import")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
