import { NotifChannel, NotifStatus, prisma } from '@taskflow/db';

import { enqueueNotificationJob, processNotificationQueue } from '../lib/queue.js';
import { sendEmail } from '../lib/mailer.js';
import { getConfigValue } from './system-config.service.js';

interface TaskNotificationPayload {
  userId: string;
  taskId: string;
  classId: string;
  className: string;
  classColor: string;
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

function formatDueAt(isoString: string | null, timezone: string): string {
  if (!isoString) {
    return '未设置';
  }

  try {
    const date = new Date(isoString);

    return (
      new Intl.DateTimeFormat('zh-CN', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date) + ` (${timezone})`
    );
  } catch {
    return isoString;
  }
}

async function createNotificationJob(
  payload: TaskNotificationPayload,
  scheduledAt: Date,
  channel: NotifChannel,
) {
  const job = await prisma.notificationJob.create({
    data: {
      channel,
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

async function getEnabledChannels(userId: string): Promise<NotifChannel[]> {
  const prefs = await prisma.userNotificationPref.findMany({
    where: { userId, isEnabled: true },
    select: { channel: true },
  });

  if (prefs.length === 0) {
    // Default to EMAIL if user has no preferences set
    return [NotifChannel.EMAIL];
  }

  return prefs.map((p) => p.channel);
}

export async function enqueueTaskPublishedNotifications(params: {
  taskId: string;
  classId: string;
  className: string;
  classColor: string;
  taskTitle: string;
  dueAt: Date | null;
  memberUserIds: string[];
}) {
  const now = new Date();

  for (const userId of params.memberUserIds) {
    const channels = await getEnabledChannels(userId);
    const payload: TaskNotificationPayload = {
      userId,
      taskId: params.taskId,
      classId: params.classId,
      className: params.className,
      classColor: params.classColor,
      taskTitle: params.taskTitle,
      dueAt: params.dueAt?.toISOString() ?? null,
      type: 'TASK_PUBLISHED',
    };

    for (const channel of channels) {
      await createNotificationJob(payload, now, channel);
    }
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
      const channels = await getEnabledChannels(userId);
      const payload: TaskNotificationPayload = {
        userId,
        taskId: params.taskId,
        classId: params.classId,
        className: params.className,
        classColor: params.classColor,
        taskTitle: params.taskTitle,
        dueAt: params.dueAt.toISOString(),
        type: 'TASK_DUE_REMINDER',
      };

      for (const channel of channels) {
        await createNotificationJob(payload, scheduledAt, channel);
      }
    }
  }
}

function buildSubject(payload: TaskNotificationPayload) {
  if (payload.type === 'TASK_PUBLISHED') {
    return `[TaskFlow] 新任务：${payload.taskTitle}`;
  }

  return `[TaskFlow] 任务截止提醒：${payload.taskTitle}`;
}

function buildText(payload: TaskNotificationPayload, timezone: string) {
  const dueText = formatDueAt(payload.dueAt, timezone);

  if (payload.type === 'TASK_PUBLISHED') {
    return `班级 ${payload.className} 发布了新任务。\n\n任务名称：${payload.taskTitle}\n截止时间：${dueText}`;
  }

  return `你在班级 ${payload.className} 中有一个任务即将到期。\n\n任务名称：${payload.taskTitle}\n截止时间：${dueText}`;
}

function buildHtml(
  payload: TaskNotificationPayload,
  timezone: string,
  baseUrl: string,
) {
  const dueText = formatDueAt(payload.dueAt, timezone);
  const accentColor = payload.classColor || '#7B6CB0';
  const taskUrl = `${baseUrl}/dashboard`;
  const unsubscribeUrl = `${baseUrl}/settings/notifications`;

  const heading =
    payload.type === 'TASK_PUBLISHED'
      ? `班级 <strong>${escapeHtml(payload.className)}</strong> 发布了新任务`
      : `你在班级 <strong>${escapeHtml(payload.className)}</strong> 中有一个任务即将到期`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#faf7f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf7f2;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#fffdf8;border-radius:8px;overflow:hidden;border:1px solid #e8e2d8;">
        <!-- Accent bar -->
        <tr><td style="height:4px;background-color:${accentColor};"></td></tr>
        <!-- Header -->
        <tr><td style="padding:24px 32px 16px;">
          <p style="margin:0;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#8a8078;">TaskFlow</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:0 32px 24px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#2c2825;">${heading}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9f6f0;border-radius:6px;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0 0 8px;font-size:14px;color:#8a8078;">任务名称</p>
              <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#2c2825;">${escapeHtml(payload.taskTitle)}</p>
              <p style="margin:0 0 8px;font-size:14px;color:#8a8078;">截止时间</p>
              <p style="margin:0;font-size:15px;color:#2c2825;">${escapeHtml(dueText)}</p>
            </td></tr>
          </table>
        </td></tr>
        <!-- CTA -->
        <tr><td style="padding:0 32px 32px;" align="center">
          <a href="${taskUrl}" style="display:inline-block;padding:10px 28px;background-color:${accentColor};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:6px;">查看任务</a>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid #e8e2d8;">
          <p style="margin:0;font-size:12px;color:#c0b8ad;text-align:center;">
            此邮件由 TaskFlow 自动发送 &middot;
            <a href="${unsubscribeUrl}" style="color:#8a8078;text-decoration:underline;">退订通知</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendWebhook(webhookUrl: string, payload: TaskNotificationPayload, timezone: string, baseUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: payload.type,
        taskId: payload.taskId,
        taskTitle: payload.taskTitle,
        className: payload.className,
        dueAt: formatDueAt(payload.dueAt, timezone),
        url: `${baseUrl}/dashboard`,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Webhook returned ${res.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
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
    const channel = job.channel;

    const pref = await prisma.userNotificationPref.findUnique({
      where: {
        userId_channel: {
          userId: payload.userId,
          channel,
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

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { email: true, timezone: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const timezone = user.timezone || 'UTC';
    const baseUrl = (await getConfigValue('app.base_url')) || 'http://localhost:3000';

    if (channel === NotifChannel.EMAIL) {
      const targetEmail = pref?.address || user.email;

      await sendEmail(
        targetEmail,
        buildSubject(payload),
        buildText(payload, timezone),
        buildHtml(payload, timezone, baseUrl),
      );
    } else if (channel === NotifChannel.WEBHOOK) {
      const webhookUrl = pref?.address;

      if (!webhookUrl) {
        throw new Error('Webhook URL not configured');
      }

      await sendWebhook(webhookUrl, payload, timezone, baseUrl);
    }

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

// ── Inbox queries ──────────────────────────────────────────────────────────

export interface NotificationItemResult {
  id: string;
  type: string;
  taskId: string | null;
  classId: string | null;
  taskTitle: string;
  className: string;
  readAt: Date | null;
  createdAt: Date;
}

function toNotificationItem(
  job: { id: string; payload: unknown; taskId: string | null; readAt: Date | null; createdAt: Date },
): NotificationItemResult {
  const p = job.payload as Record<string, unknown> | null;

  return {
    id: job.id,
    type: (p?.type as string) ?? 'TASK_PUBLISHED',
    taskId: job.taskId,
    classId: (p?.classId as string) ?? null,
    taskTitle: (p?.taskTitle as string) ?? '',
    className: (p?.className as string) ?? '',
    readAt: job.readAt,
    createdAt: job.createdAt,
  };
}

export async function listMyNotifications(
  userId: string,
  options: { limit: number; cursor?: string; unreadOnly: boolean },
) {
  const where = {
    userId,
    status: NotifStatus.SENT,
    ...(options.unreadOnly ? { readAt: null } : {}),
  };

  const [items, unreadCount] = await Promise.all([
    prisma.notificationJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit + 1,
      ...(options.cursor
        ? { cursor: { id: options.cursor }, skip: 1 }
        : {}),
      select: {
        id: true,
        payload: true,
        taskId: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.notificationJob.count({
      where: { userId, status: NotifStatus.SENT, readAt: null },
    }),
  ]);

  const hasMore = items.length > options.limit;

  if (hasMore) {
    items.pop();
  }

  return {
    items: items.map(toNotificationItem),
    nextCursor: hasMore && items.length > 0 ? items[items.length - 1].id : null,
    unreadCount,
  };
}

export async function markNotificationRead(notificationId: string, userId: string) {
  const job = await prisma.notificationJob.findUnique({
    where: { id: notificationId },
    select: { userId: true, readAt: true },
  });

  if (!job || job.userId !== userId) {
    return null;
  }

  if (job.readAt) {
    return { id: notificationId };
  }

  await prisma.notificationJob.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });

  return { id: notificationId };
}

export async function markAllNotificationsRead(userId: string) {
  const result = await prisma.notificationJob.updateMany({
    where: { userId, readAt: null, status: NotifStatus.SENT },
    data: { readAt: new Date() },
  });

  return { updated: result.count };
}

export async function getUnreadNotificationCount(userId: string) {
  const count = await prisma.notificationJob.count({
    where: { userId, status: NotifStatus.SENT, readAt: null },
  });

  return { unreadCount: count };
}
