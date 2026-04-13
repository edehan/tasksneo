export const webDataKeys = {
  classes: () => ["classes"] as const,
  myTasks: () => ["tasks", "mine"] as const,
  class: (classId: string) => ["class", classId] as const,
  classTasks: (classId: string) => ["class", classId, "tasks"] as const,
  classMembers: (classId: string) => ["class", classId, "members"] as const,
  task: (taskId: string) => ["task", taskId] as const,
  taskSubmissions: (taskId: string) => ["task", taskId, "submissions"] as const,
  notificationsCount: () => ["notifications", "count"] as const,
  notificationsList: (limit: number) =>
    ["notifications", "list", limit] as const,
};
