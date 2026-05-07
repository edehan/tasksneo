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
  TaskDetail,
  TaskSummary,
  UserProfile,
} from "@/lib/api";
import {
  getMe,
  getMySubmission,
  getTask,
  listClasses,
  listClassTasks,
} from "@/lib/api";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ExportProgress {
  phase: "gathering" | "downloading" | "zipping";
  completed: number;
  total: number;
  detail?: string;
}

export type ExportProgressCallback = (progress: ExportProgress) => void;

export interface ExportSummary {
  classCount: number;
  submissionCount: number;
  managedTaskCount: number;
  fileCount: number;
  estimatedBytes: number;
}

export interface GatheredData {
  profile: UserProfile;
  classes: ClassSummary[];
  classTaskMap: Map<string, TaskSummary[]>;
  submissions: Array<{
    submission: SubmissionDetail;
    className: string;
    taskTitle: string;
  }>;
  managedTasks: Array<{
    task: TaskDetail;
    className: string;
  }>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function sanitizePath(name: string): string {
  return (
    name
      .replace(/[/\\:*?"<>|]/g, "_")
      .replace(/\s+/g, " ")
      .trim() || "unnamed"
  );
}

/** Run async tasks in parallel batches of a given size. */
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

// ─── Gather ─────────────────────────────────────────────────────────────────

export async function gatherData(
  onProgress: ExportProgressCallback,
): Promise<GatheredData> {
  onProgress({
    phase: "gathering",
    completed: 0,
    total: 4,
    detail: "Fetching profile...",
  });

  const profile = await getMe();
  const classes = await listClasses();

  onProgress({
    phase: "gathering",
    completed: 1,
    total: 4,
    detail: "Fetching tasks...",
  });

  // Fetch tasks for all non-personal classes in parallel
  const nonPersonalClasses = classes.filter((c) => !c.isPersonal);
  const classTaskMap = new Map<string, TaskSummary[]>();

  const taskLists = await parallelBatch(nonPersonalClasses, 5, async (cls) => {
    const tasks = await listClassTasks(cls.id);
    return { classId: cls.id, tasks };
  });

  for (const { classId, tasks } of taskLists) {
    classTaskMap.set(classId, tasks);
  }

  onProgress({
    phase: "gathering",
    completed: 2,
    total: 4,
    detail: "Fetching submissions...",
  });

  // Fetch user's submissions for all tasks
  const allTasks = taskLists.flatMap(({ classId, tasks }) => {
    const cls = nonPersonalClasses.find((c) => c.id === classId);
    return tasks.map((t) => ({ task: t, className: cls?.name ?? "" }));
  });

  const submissionResults = await parallelBatch(
    allTasks,
    10,
    async ({ task, className }) => {
      try {
        const sub = await getMySubmission(task.id);
        if (sub) return { submission: sub, className, taskTitle: task.title };
      } catch {
        // Skip failed
      }
      return null;
    },
  );

  const submissions = submissionResults.filter(
    (r): r is NonNullable<typeof r> => r !== null,
  );

  onProgress({
    phase: "gathering",
    completed: 3,
    total: 4,
    detail: "Fetching managed tasks...",
  });

  // Fetch full task details for managed classes (OWNER/ADMIN) to get attachments
  const managedClasses = nonPersonalClasses.filter(
    (c) => c.myRole === "OWNER" || c.myRole === "ADMIN",
  );

  const managedTaskEntries: Array<{
    taskSummary: TaskSummary;
    className: string;
  }> = [];
  for (const cls of managedClasses) {
    const tasks = classTaskMap.get(cls.id) ?? [];
    for (const t of tasks) {
      managedTaskEntries.push({ taskSummary: t, className: cls.name });
    }
  }

  const managedTaskResults = await parallelBatch(
    managedTaskEntries,
    10,
    async ({ taskSummary, className }) => {
      try {
        const detail = await getTask(taskSummary.id);
        return { task: detail, className };
      } catch {
        return null;
      }
    },
  );

  const managedTasks = managedTaskResults.filter(
    (r): r is NonNullable<typeof r> => r !== null,
  );

  onProgress({ phase: "gathering", completed: 4, total: 4 });

  return {
    profile,
    classes,
    classTaskMap,
    submissions,
    managedTasks,
  };
}

// ─── Build export ───────────────────────────────────────────────────────────

export function computeSummary(data: GatheredData): ExportSummary {
  let fileCount = 0;
  let estimatedBytes = 0;

  for (const { submission } of data.submissions) {
    for (const att of submission.attachments) {
      fileCount++;
      estimatedBytes += att.sizeBytes ?? 0;
    }
  }

  for (const { task } of data.managedTasks) {
    for (const att of task.attachments) {
      fileCount++;
      estimatedBytes += att.sizeBytes ?? 0;
    }
  }

  return {
    classCount: data.classes.filter((c) => !c.isPersonal).length,
    submissionCount: data.submissions.length,
    managedTaskCount: data.managedTasks.length,
    fileCount,
    estimatedBytes,
  };
}

function buildDownloadTasks(data: GatheredData): {
  tasks: DownloadTask[];
  submissionFolders: Map<
    string,
    { submission: SubmissionDetail; folderName: string }
  >;
  taskFolders: Map<string, { task: TaskDetail; folderName: string }>;
} {
  // Build raw folder names
  const rawSubmissionNames = data.submissions.map(
    (s) => `提交-${sanitizePath(s.className)}-${sanitizePath(s.taskTitle)}`,
  );
  const rawTaskNames = data.managedTasks.map(
    (t) => `任务-${sanitizePath(t.className)}-${sanitizePath(t.task.title)}`,
  );

  // Deduplicate across all folder names
  const allRaw = [...rawSubmissionNames, ...rawTaskNames];
  const allDeduped = deduplicateFolderNames(allRaw);
  const dedupedSubmissionNames = allDeduped.slice(0, rawSubmissionNames.length);
  const dedupedTaskNames = allDeduped.slice(rawSubmissionNames.length);

  const downloadTasks: DownloadTask[] = [];
  const submissionFolders = new Map<
    string,
    { submission: SubmissionDetail; folderName: string }
  >();
  const taskFolders = new Map<
    string,
    { task: TaskDetail; folderName: string }
  >();

  // Submission download tasks
  for (let i = 0; i < data.submissions.length; i++) {
    const { submission } = data.submissions[i];
    const folderName = dedupedSubmissionNames[i];
    submissionFolders.set(submission.id, { submission, folderName });

    for (const att of submission.attachments) {
      downloadTasks.push({
        fileKey: att.fileKey,
        fileName: att.originalName,
        folderPath: folderName,
      });
    }
  }

  // Managed task download tasks
  for (let i = 0; i < data.managedTasks.length; i++) {
    const { task } = data.managedTasks[i];
    const folderName = dedupedTaskNames[i];
    taskFolders.set(task.id, { task, folderName });

    for (const att of task.attachments) {
      downloadTasks.push({
        fileKey: att.fileKey,
        fileName: att.originalName,
        folderPath: folderName,
      });
    }
  }

  return { tasks: downloadTasks, submissionFolders, taskFolders };
}

function buildMetadataJson(data: GatheredData) {
  const profileJson = {
    exportedAt: new Date().toISOString(),
    user: {
      id: data.profile.id,
      email: data.profile.email,
      nickname: data.profile.nickname,
      schoolName: data.profile.schoolName,
      studentId: data.profile.studentId,
      timezone: data.profile.timezone,
      createdAt: data.profile.createdAt,
    },
    classes: data.classes
      .filter((c) => !c.isPersonal)
      .map((cls) => ({
        id: cls.id,
        name: cls.name,
        description: cls.description,
        color: cls.color,
        myRole: cls.myRole,
        memberCount: cls.memberCount,
        createdAt: cls.createdAt,
        tasks: (data.classTaskMap.get(cls.id) ?? []).map((t) => ({
          id: t.id,
          title: t.title,
          startAt: t.startAt,
          dueAt: t.dueAt,
          publishedAt: t.publishedAt,
          createdAt: t.createdAt,
        })),
      })),
  };

  const submissionsJson = {
    exportedAt: new Date().toISOString(),
    submissions: data.submissions.map((s) => ({
      id: s.submission.id,
      taskId: s.submission.taskId,
      taskTitle: s.taskTitle,
      className: s.className,
      content: s.submission.content,
      score: s.submission.score,
      reviewNote: s.submission.reviewNote,
      firstSubmittedAt: s.submission.firstSubmittedAt,
      lastUpdatedAt: s.submission.lastUpdatedAt,
      attachments: s.submission.attachments.map((a: AttachmentMeta) => ({
        originalName: a.originalName,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
      })),
    })),
  };

  return {
    profileJson: JSON.stringify(profileJson, null, 2),
    submissionsJson: JSON.stringify(submissionsJson, null, 2),
  };
}

// ─── Main export function ───────────────────────────────────────────────────

export async function exportFromGatheredData(
  data: GatheredData,
  onProgress: ExportProgressCallback,
): Promise<{ skippedCount: number }> {
  // 1. Build download plan
  const {
    tasks: downloadTasks,
    submissionFolders,
    taskFolders,
  } = buildDownloadTasks(data);

  // 2. Download files (if any)
  let skippedCount = 0;
  const folderFiles = new Map<string, Array<{ name: string; blob: Blob }>>();

  if (downloadTasks.length > 0) {
    const results = await downloadAllWithConcurrency(
      downloadTasks,
      5,
      (completed, total) => {
        onProgress({ phase: "downloading", completed, total });
      },
    );

    for (const result of results) {
      if (result.error || !result.blob) {
        skippedCount++;
        continue;
      }
      const folder = result.task.folderPath;
      const existing = folderFiles.get(folder) ?? [];
      existing.push({
        name: result.task.fileName,
        blob: result.blob,
      });
      folderFiles.set(folder, existing);
    }
  }

  // 3. Build ZIP
  onProgress({ phase: "zipping", completed: 0, total: 1 });

  const zipEntries: ZipEntry[] = [];

  for (const [, { submission, folderName }] of submissionFolders) {
    zipEntries.push({
      folderName,
      files: folderFiles.get(folderName) ?? [],
      contentMd: submission.content ?? null,
    });
  }

  for (const [, { task, folderName }] of taskFolders) {
    const entry: ZipEntry = {
      folderName,
      files: folderFiles.get(folderName) ?? [],
      contentMd: null,
    };
    if (task.description) {
      entry.files = [
        ...entry.files,
        {
          name: "description.md",
          blob: new Blob([task.description], { type: "text/markdown" }),
        },
      ];
    }
    zipEntries.push(entry);
  }

  // Root files
  const { profileJson, submissionsJson } = buildMetadataJson(data);
  const rootFiles: Array<{ name: string; content: Blob | string }> = [
    { name: "profile.json", content: profileJson },
    { name: "submissions.json", content: submissionsJson },
  ];

  const zipBlob = await buildZip(zipEntries, rootFiles);

  // 4. Trigger download
  const today = new Date().toISOString().slice(0, 10);
  triggerDownload(zipBlob, `TaskNeo-Export-${today}.zip`);

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
