import { NotifChannel, NotifStatus, prisma } from '@taskflow/db';

import { enqueueNotificationJob, processNotificationQueue } from '../lib/queue.js';
import { sendEmail } from '../lib/mailer.js';
import { getConfigValue } from './system-config.service.js';

interface TaskNotificationPayload {
  userId: string;
  taskId: string;
  className: string;
  taskTitle: string;
  dueAt: string | null;
  type: 'TASK_PUBLISHED' | 'TASK_DUE_REMINDER';
}

function parseBeforeDueHours(value: string | null): number[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((part) => !Number.isNaN(part) && part > 0);
}

async function createNotificationJob(payload: TaskNotificationPayload, scheduledAt: Date) {
  const job = await prisma.notificationJob.create({
    data: {
      channel: NotifChannel.EMAIL,
      payload: payload as unknown as object,
      scheduledAt,
      status: NotifStatus.PENDING,
      userId: payload.userId,
      taskId: payload.taskId,
    },
  });

  try {
    await enqueueNotificationJob(job.id, scheduledAt);
  } catch {
    // Keep PENDING row for recovery even if queue enqueue fails.
  }
}

export async function enqueueTaskPublishedNotifications(params: {
  taskId: string;
  className: string;
  taskTitle: string;
  dueAt: Date | null;
  memberUserIds: string[];
}) {
  const now = new Date();

  for (const userId of params.memberUserIds) {
    await createNotificationJob(
      {
        userId,
        taskId: params.taskId,
        className: params.className,
        taskTitle: params.taskTitle,
        dueAt: params.dueAt?.toISOString() ?? null,
        type: 'TASK_PUBLISHED',
      },
      now,
    );
  }

  if (!params.dueAt) {
    return;
  }

  const beforeDueHours = parseBeforeDueHours(await getConfigValue('notif.before_due_hours'));

  for (const hour of beforeDueHours) {
    const scheduledAt = new Date(params.dueAt.getTime() - hour * 60 * 60 * 1000);

    if (scheduledAt.getTime() <= Date.now()) {
      continue;
    }

    for (const userId of params.memberUserIds) {
      await createNotificationJob(
        {
          userId,
          taskId: params.taskId,
          className: params.className,
          taskTitle: params.taskTitle,
          dueAt: params.dueAt.toISOString(),
          type: 'TASK_DUE_REMINDER',
        },
        scheduledAt,
      );
    }
  }
}

function buildSubject(payload: TaskNotificationPayload) {
  if (payload.type === 'TASK_PUBLISHED') {
    return `[TaskFlow] 新任务：${payload.taskTitle}`;
  }

  return `[TaskFlow] 任务截止提醒：${payload.taskTitle}`;
}

function buildText(payload: TaskNotificationPayload) {
  const dueText = payload.dueAt ?? '未设置';

  if (payload.type === 'TASK_PUBLISHED') {
    return `班级 ${payload.className} 发布了新任务。\n\n任务名称：${payload.taskTitle}\n截止时间：${dueText}`;
  }

  return `你在班级 ${payload.className} 中有一个任务即将到期。\n\n任务名称：${payload.taskTitle}\n截止时间：${dueText}`;
}

export async function processNotificationJob(notificationJobId: string) {
  const job = await prisma.notificationJob.findUnique({ where: { id: notificationJobId } });

  if (!job || job.status === NotifStatus.SENT) {
    return;
  }

  await prisma.notificationJob.update({
    where: { id: notificationJobId },
    data: {
      status: NotifStatus.SENDING,
      error: null,
    },
  });

  try {
    const payload = job.payload as unknown as TaskNotificationPayload;

    const pref = await prisma.userNotificationPref.findUnique({
      where: {
        userId_channel: {
          userId: payload.userId,
          channel: NotifChannel.EMAIL,
        },
      },
    });

    if (pref && pref.isEnabled === false) {
      await prisma.notificationJob.update({
        where: { id: notificationJobId },
        data: {
          status: NotifStatus.SENT,
          sentAt: new Date(),
          error: null,
        },
      });

      return;
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { email: true } });

    if (!user) {
      throw new Error('User not found');
    }

    const targetEmail = pref?.address || user.email;

    await sendEmail(targetEmail, buildSubject(payload), buildText(payload));

    await prisma.notificationJob.update({
      where: { id: notificationJobId },
      data: {
        status: NotifStatus.SENT,
        sentAt: new Date(),
        error: null,
      },
    });
  } catch (error) {
    await prisma.notificationJob.update({
      where: { id: notificationJobId },
      data: {
        status: NotifStatus.FAILED,
        error: error instanceof Error ? error.message : String(error),
      },
    });

    throw error;
  }
}

export function startNotificationWorker() {
  processNotificationQueue(async (payload) => {
    const notificationJobId = payload.notificationJobId;

    if (!notificationJobId) {
      return;
    }

    await processNotificationJob(notificationJobId);
  });
}
