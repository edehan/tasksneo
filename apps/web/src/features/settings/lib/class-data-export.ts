import {
  buildZip,
  type DownloadTask,
  deduplicateFolderNames,
  downloadAllWithConcurrency,
  type ZipEntry,
} from "@/features/submissions/lib/batch-download";
import type {
  AttachmentMeta,
  ClassSummary,
  SubmissionDetail,
  SubmissionListRow,
  TaskDetail,
} from "@/lib/api";
import {
  getSubmission,
  getTask,
  listClassTasks,
  listSubmissions,
} from "@/lib/api";
import { sanitizePath } from "./data-export";

export interface ClassExportProgress {
  phase: "gathering" | "downloading" | "zipping";
  completed: number;
  total: number;
  detail?: string;
}

export type ClassExportProgressCallback = (
  progress: ClassExportProgress,
) => void;

interface GatheredClassExport {
  classes: GatheredClass[];
}

interface GatheredClass {
  cls: ClassSummary;
  folderPath: string;
  tasks: GatheredTask[];
}

interface GatheredTask {
  detail: TaskDetail;
  folderPath: string;
  submissionRows: SubmissionListRow[];
  submittedDetails: Array<{
    row: SubmissionListRow;
    detail: SubmissionDetail;
    folderPath: string;
  }>;
}

interface DownloadPlan {
  tasks: DownloadTask[];
  entries: ZipEntry[];
  metadata: {
    classCount: number;
    taskCount: number;
    submissionCount: number;
  };
}

async function parallelBatch<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

function jsonBlob(value: unknown): Blob {
  return new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
}

function markdownBlob(value: string): Blob {
  return new Blob([value], { type: "text/markdown" });
}

function attachmentMetadata(attachment: AttachmentMeta) {
  return {
    id: attachment.id,
    originalName: attachment.originalName,
    renamedFile: attachment.renamedFile,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    isVisible: attachment.isVisible,
    createdAt: attachment.createdAt,
  };
}

function classMetadata(cls: ClassSummary) {
  return {
    id: cls.id,
    name: cls.name,
    description: cls.description,
    taskAiPrompt: cls.taskAiPrompt,
    color: cls.color,
    isPersonal: cls.isPersonal,
    ownerId: cls.ownerId,
    schoolId: cls.schoolId,
    inviteCode: cls.inviteCode,
    myRole: cls.myRole,
    memberCount: cls.memberCount,
    createdAt: cls.createdAt,
  };
}

function taskMetadata(task: TaskDetail) {
  return {
    id: task.id,
    classId: task.classId,
    className: task.className,
    title: task.title,
    sourceText: task.sourceText,
    startAt: task.startAt,
    dueAt: task.dueAt,
    allowLateSubmission: task.allowLateSubmission,
    blockedBy: task.blockedBy,
    isPublished: task.isPublished,
    publishedAt: task.publishedAt,
    createdBy: task.createdBy,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    submittedCount: task.submittedCount,
    memberCount: task.memberCount,
    stats: task.stats,
    attachments: task.attachments.map(attachmentMetadata),
  };
}

function submissionMetadata(
  row: SubmissionListRow,
  detail: SubmissionDetail | null,
) {
  return {
    user: {
      id: row.userId,
      nickname: row.nickname,
      studentId: row.studentId,
      schoolName: row.schoolName,
      role: row.role,
      viewedAt: row.viewedAt,
    },
    submitted: row.submitted,
    submission: detail
      ? {
          id: detail.id,
          taskId: detail.taskId,
          userId: detail.userId,
          content: detail.content,
          score: detail.score,
          reviewerId: detail.reviewerId,
          reviewedAt: detail.reviewedAt,
          reviewNote: detail.reviewNote,
          isExemplary: detail.isExemplary,
          firstSubmittedAt: detail.firstSubmittedAt,
          lastUpdatedAt: detail.lastUpdatedAt,
          attachments: detail.attachments.map(attachmentMetadata),
        }
      : row.submission
        ? {
            id: row.submission.id,
            taskId: row.submission.taskId,
            userId: row.submission.userId,
            content: row.submission.content,
            score: row.submission.score,
            reviewerId: row.submission.reviewerId,
            reviewedAt: row.submission.reviewedAt,
            reviewNote: row.submission.reviewNote,
            isExemplary: row.submission.isExemplary,
            firstSubmittedAt: row.submission.firstSubmittedAt,
            lastUpdatedAt: row.submission.lastUpdatedAt,
            attachments: row.attachments.map(attachmentMetadata),
          }
        : null,
  };
}

function studentFolderName(row: SubmissionListRow): string {
  const name = row.nickname ?? row.studentId ?? row.userId;
  return sanitizePath(name);
}

function assignSuccessfulDownloads(
  results: Awaited<ReturnType<typeof downloadAllWithConcurrency>>,
): Map<string, Array<{ name: string; blob: Blob }>> {
  const folderFiles = new Map<string, Array<{ name: string; blob: Blob }>>();
  for (const result of results) {
    if (result.error || !result.blob) continue;
    const existing = folderFiles.get(result.task.folderPath) ?? [];
    existing.push({
      name: result.task.fileName,
      blob: result.blob,
    });
    folderFiles.set(result.task.folderPath, existing);
  }
  return folderFiles;
}

function dedupeFileNames(files: Array<{ name: string; blob: Blob }>) {
  const counts = new Map<string, number>();
  return files.map((file) => {
    const count = counts.get(file.name) ?? 0;
    counts.set(file.name, count + 1);
    if (count === 0) return file;

    const dotIndex = file.name.lastIndexOf(".");
    const suffix = `_${count + 1}`;
    const name =
      dotIndex > 0
        ? `${file.name.slice(0, dotIndex)}${suffix}${file.name.slice(dotIndex)}`
        : `${file.name}${suffix}`;
    return { ...file, name };
  });
}

async function gatherClassExportData(
  selectedClasses: ClassSummary[],
  onProgress: ClassExportProgressCallback,
): Promise<GatheredClassExport> {
  const classFolderNames = deduplicateFolderNames(
    selectedClasses.map((cls) => sanitizePath(cls.name)),
  );

  const gatheredClasses: GatheredClass[] = [];

  onProgress({
    phase: "gathering",
    completed: 0,
    total: selectedClasses.length,
    detail: "Fetching class tasks...",
  });

  for (let i = 0; i < selectedClasses.length; i++) {
    const cls = selectedClasses[i];
    const classFolderPath = classFolderNames[i];
    const taskSummaries = await listClassTasks(cls.id);
    const taskFolderNames = deduplicateFolderNames(
      taskSummaries.map((task) => sanitizePath(task.title)),
    );

    const gatheredTasks = await parallelBatch(
      taskSummaries.map((summary, index) => ({
        summary,
        folderPath: `${classFolderPath}/tasks/${taskFolderNames[index]}`,
      })),
      4,
      async ({ summary, folderPath }) => {
        const [detail, submissionRows] = await Promise.all([
          getTask(summary.id),
          listSubmissions(summary.id),
        ]);

        const submittedRows = submissionRows.filter(
          (row) => row.submitted && row.submission,
        );
        const submissionDetails = await parallelBatch(
          submittedRows,
          5,
          async (row) => {
            if (!row.submission) return null;
            const detail = await getSubmission(summary.id, row.submission.id);
            return { row, detail };
          },
        );

        const validDetails = submissionDetails.filter(
          (item): item is NonNullable<typeof item> => item !== null,
        );
        const studentFolderNames = deduplicateFolderNames(
          validDetails.map(({ row }) => studentFolderName(row)),
        );

        return {
          detail,
          folderPath,
          submissionRows,
          submittedDetails: validDetails.map((item, index) => ({
            ...item,
            folderPath: `${folderPath}/submissions/${studentFolderNames[index]}`,
          })),
        };
      },
    );

    gatheredClasses.push({
      cls,
      folderPath: classFolderPath,
      tasks: gatheredTasks,
    });

    onProgress({
      phase: "gathering",
      completed: i + 1,
      total: selectedClasses.length,
      detail: `Fetched ${cls.name}`,
    });
  }

  return { classes: gatheredClasses };
}

function buildDownloadPlan(data: GatheredClassExport): DownloadPlan {
  const downloadTasks: DownloadTask[] = [];
  const entries: ZipEntry[] = [];
  let taskCount = 0;
  let submissionCount = 0;

  for (const gatheredClass of data.classes) {
    entries.push({
      folderName: gatheredClass.folderPath,
      files: [
        {
          name: "class.json",
          blob: jsonBlob(classMetadata(gatheredClass.cls)),
        },
      ],
      contentMd: null,
    });

    for (const gatheredTask of gatheredClass.tasks) {
      taskCount++;
      const detailBySubmissionId = new Map(
        gatheredTask.submittedDetails.map(({ detail }) => [detail.id, detail]),
      );
      const taskFiles: Array<{ name: string; blob: Blob }> = [
        {
          name: "task.json",
          blob: jsonBlob(taskMetadata(gatheredTask.detail)),
        },
        {
          name: "submissions.json",
          blob: jsonBlob({
            taskId: gatheredTask.detail.id,
            taskTitle: gatheredTask.detail.title,
            submissions: gatheredTask.submissionRows.map((row) =>
              submissionMetadata(
                row,
                row.submission
                  ? (detailBySubmissionId.get(row.submission.id) ?? null)
                  : null,
              ),
            ),
          }),
        },
      ];

      if (gatheredTask.detail.description) {
        taskFiles.push({
          name: "description.md",
          blob: markdownBlob(gatheredTask.detail.description),
        });
      }

      entries.push({
        folderName: gatheredTask.folderPath,
        files: taskFiles,
        contentMd: null,
      });

      for (const attachment of gatheredTask.detail.attachments) {
        downloadTasks.push({
          fileKey: attachment.fileKey,
          fileName: sanitizePath(attachment.originalName),
          folderPath: `${gatheredTask.folderPath}/attachments`,
        });
      }

      for (const submitted of gatheredTask.submittedDetails) {
        submissionCount++;
        entries.push({
          folderName: submitted.folderPath,
          files: [
            {
              name: "submission.json",
              blob: jsonBlob(
                submissionMetadata(submitted.row, submitted.detail),
              ),
            },
          ],
          contentMd: submitted.detail.content ?? null,
        });

        for (const attachment of submitted.detail.attachments) {
          downloadTasks.push({
            fileKey: attachment.fileKey,
            fileName: sanitizePath(attachment.originalName),
            folderPath: `${submitted.folderPath}/attachments`,
          });
        }
      }
    }
  }

  return {
    tasks: downloadTasks,
    entries,
    metadata: {
      classCount: data.classes.length,
      taskCount,
      submissionCount,
    },
  };
}

export async function exportClassData(
  selectedClasses: ClassSummary[],
  onProgress: ClassExportProgressCallback,
): Promise<{ skippedCount: number }> {
  const gathered = await gatherClassExportData(selectedClasses, onProgress);
  const plan = buildDownloadPlan(gathered);

  let skippedCount = 0;
  let folderFiles = new Map<string, Array<{ name: string; blob: Blob }>>();

  if (plan.tasks.length > 0) {
    const results = await downloadAllWithConcurrency(
      plan.tasks,
      5,
      (completed, total) => {
        onProgress({ phase: "downloading", completed, total });
      },
    );
    skippedCount = results.filter(
      (result) => result.error || !result.blob,
    ).length;
    folderFiles = assignSuccessfulDownloads(results);
  }

  onProgress({ phase: "zipping", completed: 0, total: 1 });

  const attachmentEntries: ZipEntry[] = Array.from(folderFiles.entries()).map(
    ([folderName, files]) => ({
      folderName,
      files: dedupeFileNames(files),
      contentMd: null,
    }),
  );

  const zipBlob = await buildZip(
    [...plan.entries, ...attachmentEntries],
    [
      {
        name: "class-data.json",
        content: JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            selectedClassCount: plan.metadata.classCount,
            taskCount: plan.metadata.taskCount,
            submissionCount: plan.metadata.submissionCount,
            skippedFileCount: skippedCount,
          },
          null,
          2,
        ),
      },
    ],
  );

  const today = new Date().toISOString().slice(0, 10);
  triggerDownload(zipBlob, `TaskNeo-Class-Data-${today}.zip`);

  return { skippedCount };
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
