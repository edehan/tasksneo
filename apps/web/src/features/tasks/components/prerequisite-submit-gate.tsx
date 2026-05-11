"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listClassTasks, type TaskSummary } from "@/lib/api";

type TaskForPrerequisiteCheck = Pick<
  TaskSummary,
  "id" | "classId" | "blockedBy"
>;

interface PrerequisiteSubmitGateProps {
  task: TaskForPrerequisiteCheck;
  onContinue: () => void;
  onOpenPrerequisite?: () => void;
  children: (props: { checking: boolean; onClick: () => void }) => ReactNode;
}

export function PrerequisiteSubmitGate({
  task,
  onContinue,
  onOpenPrerequisite,
  children,
}: PrerequisiteSubmitGateProps) {
  const t = useTranslations("taskDetailOverlay");
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [open, setOpen] = useState(false);
  const [incompletePrerequisites, setIncompletePrerequisites] = useState<
    TaskSummary[]
  >([]);

  async function handleClick() {
    if (checking) return;

    if (task.blockedBy.length === 0) {
      onContinue();
      return;
    }

    setChecking(true);
    try {
      const classTasks = await listClassTasks(task.classId);
      const taskById = new Map(classTasks.map((item) => [item.id, item]));
      const incomplete = task.blockedBy
        .map((id) => taskById.get(id))
        .filter((item): item is TaskSummary =>
          Boolean(item && !item.userState?.submittedAt),
        );

      if (incomplete.length === 0) {
        onContinue();
        return;
      }

      setIncompletePrerequisites(incomplete);
      setOpen(true);
    } catch {
      toast.error(t("prerequisites.failedCheck"));
    } finally {
      setChecking(false);
    }
  }

  function handleOpenPrerequisite(taskId: string) {
    setOpen(false);
    onOpenPrerequisite?.();
    router.push(`/tasks/${taskId}`);
  }

  function handleIgnoreAndContinue() {
    setOpen(false);
    onContinue();
  }

  return (
    <>
      {children({ checking, onClick: handleClick })}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("prerequisites.title")}</DialogTitle>
            <DialogDescription>
              {t("prerequisites.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {incompletePrerequisites.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleOpenPrerequisite(item.id)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-secondary"
              >
                <span className="min-w-0 truncate font-medium">
                  {item.title}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" onClick={handleIgnoreAndContinue}>
              {t("prerequisites.ignoreAndContinue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PrerequisiteCheckingIcon() {
  return <Loader2 className="h-3 w-3 animate-spin" />;
}
