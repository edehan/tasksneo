"use client";

import Fuse from "fuse.js";
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { unstable_serialize, useSWRConfig } from "swr";

import { useAuth } from "@/components/auth-provider";
import type {
  ClassMember,
  ClassSummary,
  MyTaskSummary,
  SubmissionListRow,
  TaskComment,
  TaskDetail,
  TaskSummary,
} from "@/lib/api";
import {
  getTask,
  listClassTasks,
  listMembers,
  listMyTasks,
  listSubmissions,
  listTaskComments,
} from "@/lib/api";
import { useClassesQuery } from "@/lib/web-data";
import { webDataKeys } from "@/lib/web-data-keys";

export type SearchResultKind =
  | "class"
  | "task"
  | "comment"
  | "attachment"
  | "member"
  | "submission";

type SearchSourceDepth = "list" | "enriched";
type SearchPhase = "idle" | "loading" | "ready" | "enriching" | "error";
type RefreshMode = "full" | "lightweight";

export interface SearchDocument {
  id: string;
  kind: SearchResultKind;
  route: string;
  title: string;
  subtitle: string;
  content: string;
  keywords: string[];
  taskId?: string;
  classId?: string;
  submissionId?: string;
  updatedAt: string;
  sourceDepth: SearchSourceDepth;
}

interface SearchStatus {
  phase: SearchPhase;
  lastRefreshAt: number | null;
  isSearching: boolean;
}

interface GlobalSearchContextValue {
  query: string;
  setQuery: (value: string) => void;
  results: SearchDocument[];
  status: SearchStatus;
  open: boolean;
  setOpen: (value: boolean) => void;
  refresh: () => Promise<void>;
}

interface SearchableDocument extends SearchDocument {
  searchTitle: string;
  searchTitleCompact: string;
  searchSubtitle: string;
  searchSubtitleCompact: string;
  searchContent: string;
  searchContentCompact: string;
  searchKeywords: string[];
  searchKeywordsCompact: string[];
}

interface IndexedTaskRecord {
  id: string;
  classId: string;
  className: string;
  classColor: string;
  manageable: boolean;
  task: TaskSummary;
}

interface PendingManagedClassFetch {
  cls: ClassSummary;
  needsTasks: boolean;
  needsMembers: boolean;
}

const GlobalSearchContext = createContext<GlobalSearchContextValue | null>(
  null,
);

const GROUP_ORDER: SearchResultKind[] = [
  "task",
  "comment",
  "submission",
  "class",
  "attachment",
  "member",
];
const GROUP_ORDER_MAP = new Map(
  GROUP_ORDER.map((kind, index) => [kind, index]),
);
const MAX_RESULTS = 24;
const CLASS_DATA_BATCH_SIZE = 1;
const TASK_ENRICHMENT_BATCH_SIZE = 1;
const DEFAULT_CLASS_COLOR = "#8B7355";
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
const SEARCH_ERROR_RETRY_COOLDOWN_MS = 30 * 1000;
const SEARCH_CACHE_KEY_PREFIX = "taskflow_global_search_v1";

interface SearchCachePayload {
  cachedAt: number;
  docs: SearchDocument[];
}

function normalizeForSearch(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactNormalizedSearch(value: string): string {
  return normalizeForSearch(value).replace(/\s+/g, "");
}

function toSearchableDocument(document: SearchDocument): SearchableDocument {
  return {
    ...document,
    searchTitle: normalizeForSearch(document.title),
    searchTitleCompact: compactNormalizedSearch(document.title),
    searchSubtitle: normalizeForSearch(document.subtitle),
    searchSubtitleCompact: compactNormalizedSearch(document.subtitle),
    searchContent: normalizeForSearch(document.content),
    searchContentCompact: compactNormalizedSearch(document.content),
    searchKeywords: document.keywords
      .map((keyword) => normalizeForSearch(keyword))
      .filter(Boolean),
    searchKeywordsCompact: document.keywords
      .map((keyword) => compactNormalizedSearch(keyword))
      .filter(Boolean),
  };
}

function upsertDocument(
  map: Map<string, SearchDocument>,
  document: SearchDocument,
): void {
  map.set(document.id, document);
}

function classRoute(classId: string): string {
  return `/classes/${classId}`;
}

function taskRoute(
  taskId: string,
  section?: "attachments" | "discussion",
): string {
  if (!section) return `/tasks/${taskId}`;
  return `/tasks/${taskId}?section=${section}`;
}

function submissionRoute(submissionId: string): string {
  return `/submissions/${submissionId}`;
}

function memberRoute(classId: string): string {
  return `/classes/${classId}/members`;
}

function getSearchCacheKey(userId: string): string {
  return `${SEARCH_CACHE_KEY_PREFIX}:${userId}`;
}

function readSWRData<T>(
  cache: { get: (key: string) => unknown },
  key: ReadonlyArray<string>,
): T | undefined {
  const cached = cache.get(unstable_serialize(key));
  if (typeof cached === "undefined") {
    return undefined;
  }

  if (
    cached &&
    typeof cached === "object" &&
    ("data" in cached ||
      "error" in cached ||
      "isLoading" in cached ||
      "isValidating" in cached)
  ) {
    const state = cached as { data?: T };
    return state.data;
  }

  return cached as T | undefined;
}

function readSearchCache(userId: string): SearchCachePayload | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(getSearchCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SearchCachePayload;
    if (typeof parsed.cachedAt !== "number" || !Array.isArray(parsed.docs)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeSearchCache(userId: string, docs: SearchDocument[]): void {
  if (typeof window === "undefined") return;

  try {
    const payload: SearchCachePayload = {
      cachedAt: Date.now(),
      docs,
    };
    window.localStorage.setItem(
      getSearchCacheKey(userId),
      JSON.stringify(payload),
    );
  } catch {
    // Ignore browser storage failures.
  }
}

function toClassDocument(cls: ClassSummary): SearchDocument {
  return {
    id: `class:${cls.id}`,
    kind: "class",
    route: classRoute(cls.id),
    title: cls.name,
    subtitle: cls.description ?? "",
    content: [cls.description, cls.myRole, String(cls.memberCount)]
      .filter(Boolean)
      .join(" "),
    keywords: [cls.name, cls.description ?? "", cls.myRole],
    classId: cls.id,
    updatedAt: cls.createdAt,
    sourceDepth: "list",
  };
}

function toTaskDocument(record: IndexedTaskRecord): SearchDocument {
  return {
    id: `task:${record.id}`,
    kind: "task",
    route: taskRoute(record.id),
    title: record.task.title,
    subtitle: record.className,
    content: record.task.sourceText ?? "",
    keywords: [record.className, record.task.title],
    taskId: record.id,
    classId: record.classId,
    updatedAt: record.task.updatedAt,
    sourceDepth: "list",
  };
}

function toMemberDocument(
  member: ClassMember,
  cls: ClassSummary,
): SearchDocument {
  const displayName = member.nickname || member.userId;
  return {
    id: `member:${cls.id}:${member.userId}`,
    kind: "member",
    route: memberRoute(cls.id),
    title: displayName,
    subtitle: cls.name,
    content: [member.role, member.joinedAt].join(" "),
    keywords: [displayName, cls.name, member.role],
    classId: cls.id,
    updatedAt: member.joinedAt,
    sourceDepth: "list",
  };
}

function mergeTaskRecord(
  taskMap: Map<string, IndexedTaskRecord>,
  task: TaskSummary | MyTaskSummary,
  classInfo: ClassSummary | null,
  manageable: boolean,
): void {
  const existing = taskMap.get(task.id);
  const nextClassName =
    task.className || classInfo?.name || existing?.className || "";
  const nextClassColor =
    ("classColor" in task && task.classColor) ||
    classInfo?.color ||
    existing?.classColor ||
    DEFAULT_CLASS_COLOR;

  taskMap.set(task.id, {
    id: task.id,
    classId: task.classId,
    className: nextClassName,
    classColor: nextClassColor,
    manageable: existing?.manageable || manageable,
    task: {
      ...task,
      className: nextClassName,
    },
  });
}

function sortAndLimitResults(
  results: Array<{ document: SearchDocument; rank: number }>,
): SearchDocument[] {
  return results
    .sort((left, right) => {
      const leftGroup = GROUP_ORDER_MAP.get(left.document.kind) ?? 999;
      const rightGroup = GROUP_ORDER_MAP.get(right.document.kind) ?? 999;
      if (leftGroup !== rightGroup) return leftGroup - rightGroup;
      if (left.rank !== right.rank) return left.rank - right.rank;
      return left.document.title.localeCompare(right.document.title);
    })
    .slice(0, MAX_RESULTS)
    .map((entry) => entry.document);
}

function searchSingleCharacter(
  normalizedQuery: string,
  compactQuery: string,
  documents: SearchableDocument[],
): SearchDocument[] {
  const ranked: Array<{ document: SearchDocument; rank: number }> = [];

  for (const document of documents) {
    const keywordHit = document.searchKeywords.find((keyword) =>
      keyword.includes(normalizedQuery),
    );
    const compactKeywordHit = document.searchKeywordsCompact.find((keyword) =>
      keyword.includes(compactQuery),
    );
    let rank = Number.POSITIVE_INFINITY;

    if (
      document.searchTitle === normalizedQuery ||
      document.searchTitleCompact === compactQuery
    ) {
      rank = 0;
    } else if (keywordHit === normalizedQuery) rank = 1;
    else if (compactKeywordHit === compactQuery) rank = 1;
    else if (document.searchTitle.startsWith(normalizedQuery)) rank = 2;
    else if (document.searchTitleCompact.startsWith(compactQuery)) rank = 2;
    else if (keywordHit?.startsWith(normalizedQuery)) rank = 3;
    else if (compactKeywordHit?.startsWith(compactQuery)) rank = 3;
    else if (document.searchTitle.includes(normalizedQuery)) rank = 4;
    else if (document.searchTitleCompact.includes(compactQuery)) rank = 4;
    else if (keywordHit || compactKeywordHit) rank = 5;

    if (Number.isFinite(rank)) {
      ranked.push({ document, rank });
    }
  }

  return sortAndLimitResults(ranked);
}

function searchDocuments(
  query: string,
  documents: SearchableDocument[],
  fuse: Fuse<SearchableDocument>,
): SearchDocument[] {
  const normalizedQuery = normalizeForSearch(query);
  const compactQuery = normalizedQuery.replace(/\s+/g, "");
  if (!normalizedQuery) return [];
  if (normalizedQuery.length === 1) {
    return searchSingleCharacter(normalizedQuery, compactQuery, documents);
  }

  return sortAndLimitResults(
    fuse.search(compactQuery, { limit: MAX_RESULTS * 2 }).map((result) => ({
      document: result.item,
      rank: result.score ?? 1,
    })),
  );
}

async function loadImmediateSnapshot(
  seed: {
    classes?: ClassSummary[];
    myTasks?: MyTaskSummary[];
    managedTaskLists?: Map<string, TaskSummary[]>;
    memberLists?: Map<string, ClassMember[]>;
  } = {},
): Promise<{
  docs: SearchDocument[];
  taskRecords: IndexedTaskRecord[];
  pendingManagedClasses: PendingManagedClassFetch[];
}> {
  const classes = seed.classes ?? [];
  const managedClasses = classes.filter(
    (cls) => cls.myRole === "OWNER" || cls.myRole === "ADMIN",
  );
  const classMap = new Map(classes.map((cls) => [cls.id, cls]));

  const myTasks = Array.isArray(seed.myTasks)
    ? seed.myTasks
    : await listMyTasks();
  const pendingManagedClasses: PendingManagedClassFetch[] = [];

  const taskMap = new Map<string, IndexedTaskRecord>();

  for (const task of myTasks) {
    mergeTaskRecord(taskMap, task, classMap.get(task.classId) ?? null, false);
  }

  const documentMap = new Map<string, SearchDocument>();
  for (const cls of classes) {
    upsertDocument(documentMap, toClassDocument(cls));
  }

  managedClasses.forEach((cls) => {
    const cachedTasks = seed.managedTaskLists?.get(cls.id);
    const cachedMembers = seed.memberLists?.get(cls.id);

    if (Array.isArray(cachedTasks)) {
      for (const task of cachedTasks) {
        mergeTaskRecord(taskMap, task, cls, true);
      }
    }

    if (Array.isArray(cachedMembers)) {
      for (const member of cachedMembers) {
        upsertDocument(documentMap, toMemberDocument(member, cls));
      }
    }

    if (!cachedTasks || !cachedMembers) {
      pendingManagedClasses.push({
        cls,
        needsTasks: !cachedTasks,
        needsMembers: !cachedMembers,
      });
    }
  });

  for (const record of taskMap.values()) {
    upsertDocument(documentMap, toTaskDocument(record));
  }

  return {
    docs: Array.from(documentMap.values()),
    taskRecords: Array.from(taskMap.values()),
    pendingManagedClasses,
  };
}

function mergeManagedClassData(args: {
  docs: Map<string, SearchDocument>;
  taskMap: Map<string, IndexedTaskRecord>;
  cls: ClassSummary;
  tasks: TaskSummary[];
  members: ClassMember[];
}): void {
  const { docs, taskMap, cls, tasks, members } = args;

  for (const task of tasks) {
    mergeTaskRecord(taskMap, task, cls, true);
  }

  for (const member of members) {
    upsertDocument(docs, toMemberDocument(member, cls));
  }

  for (const record of taskMap.values()) {
    upsertDocument(docs, toTaskDocument(record));
  }
}

async function loadManagedClassDataBatch(
  classes: PendingManagedClassFetch[],
): Promise<
  Array<{
    cls: ClassSummary;
    tasks: TaskSummary[];
    members: ClassMember[];
  }>
> {
  return Promise.all(
    classes.map(async ({ cls, needsTasks, needsMembers }) => ({
      cls,
      tasks: needsTasks
        ? await listClassTasks(cls.id).catch(() => [] as TaskSummary[])
        : [],
      members: needsMembers
        ? await listMembers(cls.id).catch(() => [] as ClassMember[])
        : [],
    })),
  );
}

function upsertDocuments(
  baseDocuments: Map<string, SearchDocument>,
  incomingDocuments: SearchDocument[],
): Map<string, SearchDocument> {
  for (const document of incomingDocuments) {
    upsertDocument(baseDocuments, document);
  }
  return baseDocuments;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function createTaskRecordMap(
  records: IndexedTaskRecord[],
): Map<string, IndexedTaskRecord> {
  return new Map(records.map((record) => [record.id, record]));
}

function toDocumentArray(
  documentMap: Map<string, SearchDocument>,
): SearchDocument[] {
  return Array.from(documentMap.values());
}

function setDocumentsAndPersist(args: {
  userId: string;
  docs: Map<string, SearchDocument>;
  setDocuments: (documents: SearchDocument[]) => void;
  setPhase: (phase: SearchPhase) => void;
  phase: SearchPhase;
}): void {
  const documents = toDocumentArray(args.docs);
  startTransition(() => {
    args.setDocuments(documents);
    args.setPhase(args.phase);
  });
  writeSearchCache(args.userId, documents);
}

function hydrateCacheState(args: {
  docs: SearchDocument[];
  cachedAt: number;
  setDocuments: (documents: SearchDocument[]) => void;
  setLastRefreshAt: (value: number) => void;
  setPhase: (phase: SearchPhase) => void;
}): void {
  args.setDocuments(args.docs);
  args.setLastRefreshAt(args.cachedAt);
  args.setPhase("ready");
}

function buildEnrichedTaskDocument(
  detail: TaskDetail,
  record: IndexedTaskRecord,
): SearchDocument {
  return {
    id: `task:${detail.id}`,
    kind: "task",
    route: taskRoute(detail.id),
    title: detail.title,
    subtitle: record.className,
    content: [
      detail.sourceText ?? "",
      detail.description ?? "",
      ...detail.attachments.map((attachment) => attachment.originalName ?? ""),
    ]
      .filter(Boolean)
      .join(" "),
    keywords: [record.className, detail.title],
    taskId: detail.id,
    classId: record.classId,
    updatedAt: detail.updatedAt,
    sourceDepth: "enriched",
  };
}

function buildAttachmentDocuments(
  detail: TaskDetail,
  record: IndexedTaskRecord,
): SearchDocument[] {
  return detail.attachments.map((attachment) => ({
    id: `attachment:${detail.id}:${attachment.id}`,
    kind: "attachment",
    route: taskRoute(detail.id, "attachments"),
    title: attachment.originalName ?? attachment.fileKey,
    subtitle: `${detail.title} • ${record.className}`,
    content: [attachment.renamedFile, attachment.mimeType, attachment.fileKey]
      .filter(Boolean)
      .join(" "),
    keywords: [detail.title, record.className, attachment.originalName ?? ""],
    taskId: detail.id,
    classId: record.classId,
    updatedAt: attachment.createdAt,
    sourceDepth: "enriched",
  }));
}

function buildCommentDocuments(
  comments: TaskComment[],
  record: IndexedTaskRecord,
): SearchDocument[] {
  return comments.map((comment) => {
    const authorName = comment.author?.nickname ?? "Comment";
    return {
      id: `comment:${record.id}:${comment.id}`,
      kind: "comment",
      route: taskRoute(record.id, "discussion"),
      title: authorName,
      subtitle: `${record.task.title} • ${record.className}`,
      content: comment.content,
      keywords: [
        authorName,
        comment.replyTo?.nickname ?? "",
        record.task.title,
        record.className,
      ],
      taskId: record.id,
      classId: record.classId,
      updatedAt: comment.createdAt,
      sourceDepth: "enriched",
    };
  });
}

function buildSubmissionDocuments(
  rows: SubmissionListRow[],
  record: IndexedTaskRecord,
): SearchDocument[] {
  return rows.flatMap((row) => {
    if (!row.submission) return [];

    const displayName = row.nickname || row.studentId || "Student";
    return [
      {
        id: `submission:${record.id}:${row.submission.id}`,
        kind: "submission",
        route: submissionRoute(row.submission.id),
        title: displayName,
        subtitle: `${record.task.title} • ${record.className}`,
        content: [
          row.submission.content ?? "",
          row.submission.reviewNote ?? "",
          row.submission.score ?? "",
          ...row.attachments.map((attachment) => attachment.originalName ?? ""),
        ]
          .filter(Boolean)
          .join(" "),
        keywords: [
          displayName,
          row.studentId ?? "",
          row.schoolName ?? "",
          record.task.title,
          record.className,
        ],
        taskId: record.id,
        classId: record.classId,
        submissionId: row.submission.id,
        updatedAt: row.submission.lastUpdatedAt,
        sourceDepth: "enriched",
      },
    ];
  });
}

async function enrichTaskRecord(
  record: IndexedTaskRecord,
): Promise<SearchDocument[]> {
  const [detailResult, commentsResult, submissionsResult] = await Promise.all([
    getTask(record.id),
    listTaskComments(record.id).catch(() => [] as TaskComment[]),
    record.manageable
      ? listSubmissions(record.id).catch(() => [] as SubmissionListRow[])
      : Promise.resolve([] as SubmissionListRow[]),
  ]);

  return [
    buildEnrichedTaskDocument(detailResult, record),
    ...buildAttachmentDocuments(detailResult, record),
    ...buildCommentDocuments(commentsResult, record),
    ...buildSubmissionDocuments(submissionsResult, record),
  ];
}

export function GlobalSearchProvider({
  initialClasses,
  children,
}: {
  initialClasses: ClassSummary[];
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const { cache } = useSWRConfig();
  const { data: classes = initialClasses } = useClassesQuery({
    fallbackData: initialClasses,
  });
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [documents, setDocuments] = useState<SearchDocument[]>([]);
  const [phase, setPhase] = useState<SearchPhase>("idle");
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);

  const deferredQuery = useDeferredValue(query);
  const refreshGenerationRef = useRef(0);
  const refreshInFlightRef = useRef(false);
  const lastRefreshErrorAtRef = useRef<number | null>(null);
  const documentsRef = useRef<SearchDocument[]>([]);
  const cacheHydratedRef = useRef(false);

  useEffect(() => {
    documentsRef.current = documents;
  }, [documents]);

  const searchableDocuments = useMemo(
    () => documents.map((document) => toSearchableDocument(document)),
    [documents],
  );

  const fuse = useMemo(
    () =>
      new Fuse(searchableDocuments, {
        includeScore: true,
        ignoreLocation: true,
        threshold: 0.3,
        keys: [
          { name: "searchTitle", weight: 0.45 },
          { name: "searchTitleCompact", weight: 0.45 },
          { name: "searchSubtitle", weight: 0.2 },
          { name: "searchSubtitleCompact", weight: 0.2 },
          { name: "searchKeywords", weight: 0.2 },
          { name: "searchKeywordsCompact", weight: 0.2 },
          { name: "searchContent", weight: 0.15 },
          { name: "searchContentCompact", weight: 0.15 },
        ],
      }),
    [searchableDocuments],
  );

  const results = useMemo(
    () => searchDocuments(deferredQuery, searchableDocuments, fuse),
    [deferredQuery, searchableDocuments, fuse],
  );

  const runRefresh = useCallback(
    async (mode: RefreshMode) => {
      if (!user || !user?.id || refreshInFlightRef.current) return;

      refreshInFlightRef.current = true;
      const generation = refreshGenerationRef.current + 1;
      refreshGenerationRef.current = generation;

      if (mode === "full" || documentsRef.current.length === 0) {
        setPhase("loading");
      }

      try {
        const cachedMyTasks = readSWRData<MyTaskSummary[]>(
          cache,
          webDataKeys.myTasks(),
        );
        const managedClasses = classes.filter(
          (cls) => cls.myRole === "OWNER" || cls.myRole === "ADMIN",
        );
        const cachedTaskLists = new Map<string, TaskSummary[]>();
        const cachedMemberLists = new Map<string, ClassMember[]>();

        managedClasses.forEach((cls) => {
          const taskList = readSWRData<TaskSummary[]>(
            cache,
            webDataKeys.classTasks(cls.id),
          );
          if (taskList) {
            cachedTaskLists.set(cls.id, taskList);
          }

          const members = readSWRData<ClassMember[]>(
            cache,
            webDataKeys.classMembers(cls.id),
          );
          if (members) {
            cachedMemberLists.set(cls.id, members);
          }
        });

        const snapshot = await loadImmediateSnapshot({
          classes,
          myTasks: cachedMyTasks,
          managedTaskLists: cachedTaskLists,
          memberLists: cachedMemberLists,
        });
        if (refreshGenerationRef.current !== generation) return;

        const taskMap = createTaskRecordMap(snapshot.taskRecords);
        const nextDocuments = new Map(
          snapshot.docs.map((document) => [document.id, document]),
        );

        setDocumentsAndPersist({
          userId: user.id,
          docs: nextDocuments,
          setDocuments,
          setPhase,
          phase:
            snapshot.pendingManagedClasses.length > 0 ||
            snapshot.taskRecords.length > 0
              ? "enriching"
              : "ready",
        });
        cacheHydratedRef.current = true;
        const refreshedAt = Date.now();
        setLastRefreshAt(refreshedAt);

        for (const batch of chunk(
          snapshot.pendingManagedClasses,
          CLASS_DATA_BATCH_SIZE,
        )) {
          const managedResults = await loadManagedClassDataBatch(batch);

          if (refreshGenerationRef.current !== generation) return;

          for (const result of managedResults) {
            mergeManagedClassData({
              docs: nextDocuments,
              taskMap,
              cls: result.cls,
              tasks: result.tasks,
              members: result.members,
            });
          }

          setDocumentsAndPersist({
            userId: user.id,
            docs: nextDocuments,
            setDocuments,
            setPhase,
            phase: "enriching",
          });
        }

        const taskRecords = Array.from(taskMap.values());
        if (taskRecords.length === 0) {
          setPhase("ready");
          return;
        }

        for (const batch of chunk(taskRecords, TASK_ENRICHMENT_BATCH_SIZE)) {
          const enrichedBatches = await Promise.all(
            batch.map((record) =>
              enrichTaskRecord(record).catch(() => [] as SearchDocument[]),
            ),
          );

          if (refreshGenerationRef.current !== generation) return;

          for (const documentsBatch of enrichedBatches) {
            upsertDocuments(nextDocuments, documentsBatch);
          }

          setDocumentsAndPersist({
            userId: user.id,
            docs: nextDocuments,
            setDocuments,
            setPhase,
            phase: "enriching",
          });
        }

        if (refreshGenerationRef.current === generation) {
          setPhase("ready");
          lastRefreshErrorAtRef.current = null;
          writeSearchCache(user.id, toDocumentArray(nextDocuments));
        }
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[global-search] refresh failed", error);
        }
        if (refreshGenerationRef.current === generation) {
          setPhase("error");
          lastRefreshErrorAtRef.current = Date.now();
        }
      } finally {
        if (refreshGenerationRef.current === generation) {
          refreshInFlightRef.current = false;
        }
      }
    },
    [cache, classes, user, user?.id],
  );

  const refresh = useCallback(async () => {
    await runRefresh("full");
  }, [runRefresh]);

  useEffect(() => {
    if (!user || !user?.id) {
      refreshGenerationRef.current += 1;
      refreshInFlightRef.current = false;
      lastRefreshErrorAtRef.current = null;
      setDocuments([]);
      setPhase("idle");
      setLastRefreshAt(null);
      cacheHydratedRef.current = false;
      return;
    }
  }, [user, user?.id]);

  useEffect(() => {
    if (!open || !user || !user?.id) return;

    const cached = readSearchCache(user.id);
    const now = Date.now();
    const hasFreshCache =
      cached !== null && now - cached.cachedAt < SEARCH_CACHE_TTL_MS;
    const hasFreshInMemory =
      lastRefreshAt !== null && now - lastRefreshAt < SEARCH_CACHE_TTL_MS;
    const isInErrorCooldown =
      lastRefreshErrorAtRef.current !== null &&
      now - lastRefreshErrorAtRef.current < SEARCH_ERROR_RETRY_COOLDOWN_MS;

    if (!cacheHydratedRef.current && cached) {
      cacheHydratedRef.current = true;
      hydrateCacheState({
        docs: cached.docs,
        cachedAt: cached.cachedAt,
        setDocuments,
        setLastRefreshAt,
        setPhase,
      });
    }

    if (
      hasFreshCache ||
      hasFreshInMemory ||
      isInErrorCooldown ||
      refreshInFlightRef.current ||
      phase === "loading" ||
      phase === "enriching"
    ) {
      return;
    }

    void runRefresh(cached ? "lightweight" : "full");
  }, [lastRefreshAt, open, phase, runRefresh, user, user?.id]);

  const value = useMemo<GlobalSearchContextValue>(
    () => ({
      query,
      setQuery,
      results,
      status: {
        phase,
        lastRefreshAt,
        isSearching: query !== deferredQuery,
      },
      open,
      setOpen,
      refresh,
    }),
    [deferredQuery, lastRefreshAt, open, phase, query, refresh, results],
  );

  return (
    <GlobalSearchContext.Provider value={value}>
      {children}
    </GlobalSearchContext.Provider>
  );
}

export function useGlobalSearch(): GlobalSearchContextValue {
  const context = useContext(GlobalSearchContext);
  if (!context) {
    throw new Error("useGlobalSearch must be used within GlobalSearchProvider");
  }
  return context;
}
