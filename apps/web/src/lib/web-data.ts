"use client";

import useSWR, { type SWRConfiguration } from "swr";
import type {
  ClassMember,
  ClassSummary,
  MyTaskSummary,
  NotificationListResponse,
  SubmissionListRow,
  TaskDetail,
  TaskSummary,
} from "@/lib/api";
import {
  getClass,
  getTask,
  getUnreadNotificationCount,
  listClasses,
  listClassTasks,
  listMembers,
  listMyNotifications,
  listMyTasks,
  listSubmissions,
} from "@/lib/api";
import { webDataKeys } from "@/lib/web-data-keys";

type QueryOptions<T> = Pick<
  SWRConfiguration<T>,
  "fallbackData" | "refreshInterval" | "revalidateOnMount"
>;

function buildOptions<T>(options?: QueryOptions<T>): SWRConfiguration<T> {
  return {
    fallbackData: options?.fallbackData,
    refreshInterval: options?.refreshInterval,
    revalidateOnMount:
      options?.revalidateOnMount ?? options?.fallbackData === undefined,
  };
}

export function useClassesQuery(options?: QueryOptions<ClassSummary[]>) {
  return useSWR(webDataKeys.classes(), listClasses, buildOptions(options));
}

export function useMyTasksQuery(options?: QueryOptions<MyTaskSummary[]>) {
  return useSWR(webDataKeys.myTasks(), listMyTasks, buildOptions(options));
}

export function useClassQuery(
  classId: string | null | undefined,
  options?: QueryOptions<ClassSummary>,
) {
  return useSWR(
    classId ? webDataKeys.class(classId) : null,
    ([, resolvedClassId]) => getClass(resolvedClassId),
    buildOptions(options),
  );
}

export function useClassTasksQuery(
  classId: string | null | undefined,
  options?: QueryOptions<TaskSummary[]>,
) {
  return useSWR(
    classId ? webDataKeys.classTasks(classId) : null,
    ([, resolvedClassId]) => listClassTasks(resolvedClassId),
    buildOptions(options),
  );
}

export function useClassMembersQuery(
  classId: string | null | undefined,
  options?: QueryOptions<ClassMember[]>,
) {
  return useSWR(
    classId ? webDataKeys.classMembers(classId) : null,
    ([, resolvedClassId]) => listMembers(resolvedClassId),
    buildOptions(options),
  );
}

export function useTaskQuery(
  taskId: string | null | undefined,
  options?: QueryOptions<TaskDetail>,
) {
  return useSWR(
    taskId ? webDataKeys.task(taskId) : null,
    ([, resolvedTaskId]) => getTask(resolvedTaskId),
    buildOptions(options),
  );
}

export function useTaskSubmissionsQuery(
  taskId: string | null | undefined,
  options?: QueryOptions<SubmissionListRow[]>,
) {
  return useSWR(
    taskId ? webDataKeys.taskSubmissions(taskId) : null,
    ([, resolvedTaskId]) => listSubmissions(resolvedTaskId),
    buildOptions(options),
  );
}

export function useNotificationsCountQuery(
  options?: QueryOptions<{ unreadCount: number }>,
) {
  return useSWR(
    webDataKeys.notificationsCount(),
    getUnreadNotificationCount,
    buildOptions(options),
  );
}

export function useNotificationsListQuery(
  limit: number,
  options?: QueryOptions<NotificationListResponse> & { enabled?: boolean },
) {
  return useSWR(
    options?.enabled === false ? null : webDataKeys.notificationsList(limit),
    ([, , resolvedLimit]) => listMyNotifications({ limit: resolvedLimit }),
    buildOptions(options),
  );
}
