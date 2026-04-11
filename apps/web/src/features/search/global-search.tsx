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
  listClasses,
  listClassTasks,
  listMembers,
  listMyTasks,
  listSubmissions,
  listTaskComments,
} from "@/lib/api";

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
const BACKGROUND_BATCH_SIZE = 3;
const LIGHT_REFRESH_INTERVAL_MS = 2 * 60 * 1000;
const DEFAULT_CLASS_COLOR = "#8B7355";

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

async function loadImmediateSnapshot(token: string): Promise<{
  docs: SearchDocument[];
  taskRecords: IndexedTaskRecord[];
}> {
  const classes = await listClasses(token);
  const managedClasses = classes.filter(
    (cls) => cls.myRole === "OWNER" || cls.myRole === "ADMIN",
  );
  const classMap = new Map(classes.map((cls) => [cls.id, cls]));

  const [myTasks, managedTaskLists, memberLists] = await Promise.all([
    listMyTasks(token),
    Promise.all(managedClasses.map((cls) => listClassTasks(token, cls.id))),
    Promise.all(managedClasses.map((cls) => listMembers(token, cls.id))),
  ]);

  const taskMap = new Map<string, IndexedTaskRecord>();

  for (const task of myTasks) {
    mergeTaskRecord(taskMap, task, classMap.get(task.classId) ?? null, false);
  }

  managedTaskLists.forEach((tasks, index) => {
    const cls = managedClasses[index];
    for (const task of tasks) {
      mergeTaskRecord(taskMap, task, cls, true);
    }
  });

  const documentMap = new Map<string, SearchDocument>();
  for (const cls of classes) {
    upsertDocument(documentMap, toClassDocument(cls));
  }

  memberLists.forEach((members, index) => {
    const cls = managedClasses[index];
    for (const member of members) {
      upsertDocument(documentMap, toMemberDocument(member, cls));
    }
  });

  for (const record of taskMap.values()) {
    upsertDocument(documentMap, toTaskDocument(record));
  }

  return {
    docs: Array.from(documentMap.values()),
    taskRecords: Array.from(taskMap.values()),
  };
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
  token: string,
  record: IndexedTaskRecord,
): Promise<SearchDocument[]> {
  const [detailResult, commentsResult, submissionsResult] = await Promise.all([
    getTask(token, record.id),
    listTaskComments(token, record.id).catch(() => [] as TaskComment[]),
    record.manageable
      ? listSubmissions(token, record.id).catch(() => [] as SubmissionListRow[])
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
  children,
}: {
  children: React.ReactNode;
}) {
  const { token } = useAuth();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [documents, setDocuments] = useState<SearchDocument[]>([]);
  const [phase, setPhase] = useState<SearchPhase>("idle");
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);

  const deferredQuery = useDeferredValue(query);
  const refreshGenerationRef = useRef(0);
  const lastRefreshRef = useRef<number | null>(null);
  const documentsRef = useRef<SearchDocument[]>([]);

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
      if (!token) return;

      const generation = refreshGenerationRef.current + 1;
      refreshGenerationRef.current = generation;

      if (mode === "full" || documentsRef.current.length === 0) {
        setPhase("loading");
      }

      try {
        const snapshot = await loadImmediateSnapshot(token);
        if (refreshGenerationRef.current !== generation) return;

        startTransition(() => {
          setDocuments(snapshot.docs);
          setPhase(snapshot.taskRecords.length > 0 ? "enriching" : "ready");
        });

        const refreshedAt = Date.now();
        lastRefreshRef.current = refreshedAt;
        setLastRefreshAt(refreshedAt);

        if (snapshot.taskRecords.length === 0) return;

        const nextDocuments = new Map(
          snapshot.docs.map((document) => [document.id, document]),
        );

        for (
          let index = 0;
          index < snapshot.taskRecords.length;
          index += BACKGROUND_BATCH_SIZE
        ) {
          const batch = snapshot.taskRecords.slice(
            index,
            index + BACKGROUND_BATCH_SIZE,
          );

          const enrichedBatches = await Promise.all(
            batch.map((record) =>
              enrichTaskRecord(token, record).catch(
                () => [] as SearchDocument[],
              ),
            ),
          );

          if (refreshGenerationRef.current !== generation) return;

          for (const documentsBatch of enrichedBatches) {
            for (const document of documentsBatch) {
              upsertDocument(nextDocuments, document);
            }
          }

          const mergedDocuments = Array.from(nextDocuments.values());
          startTransition(() => {
            setDocuments(mergedDocuments);
            setPhase("enriching");
          });
        }

        if (refreshGenerationRef.current === generation) {
          setPhase("ready");
        }
      } catch {
        if (refreshGenerationRef.current === generation) {
          setPhase("error");
        }
      }
    },
    [token],
  );

  const refresh = useCallback(async () => {
    await runRefresh("full");
  }, [runRefresh]);

  useEffect(() => {
    if (!token) {
      refreshGenerationRef.current += 1;
      setDocuments([]);
      setPhase("idle");
      setLastRefreshAt(null);
      lastRefreshRef.current = null;
      return;
    }

    void runRefresh("full");
  }, [runRefresh, token]);

  useEffect(() => {
    if (!token) return;

    function handleFocus() {
      const lastRefresh = lastRefreshRef.current;
      if (
        !lastRefresh ||
        Date.now() - lastRefresh > LIGHT_REFRESH_INTERVAL_MS
      ) {
        void runRefresh("lightweight");
      }
    }

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [runRefresh, token]);

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
