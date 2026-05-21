import { ClassRole, NotifChannel, NotifStatus, prisma } from "@taskflow/db";
import {
	formatDueAt,
	renderAnnouncementEmail,
	renderCommentEmail,
	renderTaskNotificationEmail,
} from "../lib/email-templates.js";
import { type AppLocale, normalizeLocale } from "../lib/locale.js";
import { sendEmail } from "../lib/mailer.js";
import {
	enqueueNotificationJob,
	processNotificationQueue,
} from "../lib/queue.js";
import { getConfigValue } from "./system-config.service.js";

interface TaskNotificationPayload {
	userId: string;
	taskId: string;
	classId: string;
	className: string;
	classColor: string;
	taskTitle: string;
	dueAt: string | null;
	type: "TASK_PUBLISHED" | "TASK_DUE_REMINDER";
}

interface AnnouncementNotificationPayload {
	userId: string;
	type: "SITE_ANNOUNCEMENT";
	announcementId: string;
	title: string;
	content: string;
}

interface CommentNotificationPayload {
	userId: string;
	taskId: string;
	type: "TASK_COMMENT";
	className: string;
	classColor: string;
	taskTitle: string;
	commentAuthorName: string;
	commentContent: string;
	isReply: boolean;
}

type NotificationPayload =
	| TaskNotificationPayload
	| AnnouncementNotificationPayload
	| CommentNotificationPayload;

const DEFAULT_APP_TITLE = "TaskNeo";

function parseBeforeDueHours(value: string | null): number[] {
	if (!value) {
		return [];
	}

	return value
		.split(",")
		.map((part) => Number(part.trim()))
		.filter((part) => !Number.isNaN(part) && part > 0);
}

type JobRow = {
	channel: NotifChannel;
	payload: object;
	scheduledAt: Date;
	status: (typeof NotifStatus)[keyof typeof NotifStatus];
	userId: string;
	taskId: string;
};

/**
 * Insert all job rows in one createMany, then enqueue them all concurrently.
 * Falls back gracefully: PENDING rows survive a Bull enqueue failure.
 */
async function batchCreateAndEnqueueJobs(rows: JobRow[]): Promise<void> {
	if (rows.length === 0) return;

	await prisma.notificationJob.createMany({ data: rows });

	// Retrieve the created IDs — createMany doesn't return records.
	const created = await prisma.notificationJob.findMany({
		where: {
			taskId: rows[0].taskId,
			userId: { in: [...new Set(rows.map((r) => r.userId))] },
			scheduledAt: { in: [...new Set(rows.map((r) => r.scheduledAt))] },
			status: NotifStatus.PENDING,
		},
		select: { id: true, scheduledAt: true },
	});

	await Promise.all(
		created.map((job) =>
			enqueueNotificationJob(job.id, job.scheduledAt).catch(() => {
				// Keep PENDING row for recovery even if enqueue fails.
			}),
		),
	);
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
	if (params.memberUserIds.length === 0) {
		return;
	}

	const now = new Date();

	// Batch-fetch all user channel preferences in one query.
	// Users with no preferences default to EMAIL.
	const allPrefs = await prisma.userNotificationPref.findMany({
		where: { userId: { in: params.memberUserIds }, isEnabled: true },
		select: { userId: true, channel: true },
	});

	const channelMap = new Map<string, NotifChannel[]>();
	for (const pref of allPrefs) {
		const list = channelMap.get(pref.userId) ?? [];
		list.push(pref.channel);
		channelMap.set(pref.userId, list);
	}

	// Build all TASK_PUBLISHED job rows in memory, then insert in one shot.
	const publishedRows: JobRow[] = [];
	for (const userId of params.memberUserIds) {
		const channels = channelMap.get(userId) ?? [NotifChannel.EMAIL];
		const payload: TaskNotificationPayload = {
			userId,
			taskId: params.taskId,
			classId: params.classId,
			className: params.className,
			classColor: params.classColor,
			taskTitle: params.taskTitle,
			dueAt: params.dueAt?.toISOString() ?? null,
			type: "TASK_PUBLISHED",
		};
		for (const channel of channels) {
			publishedRows.push({
				channel,
				payload: payload as unknown as object,
				scheduledAt: now,
				status: NotifStatus.PENDING,
				userId,
				taskId: params.taskId,
			});
		}
	}

	await batchCreateAndEnqueueJobs(publishedRows);

	if (!params.dueAt) {
		return;
	}

	const beforeDueHours = parseBeforeDueHours(
		await getConfigValue("notif.before_due_hours"),
	);

	// Group reminder rows by scheduledAt so we can enqueue each batch.
	const reminderRows: JobRow[] = [];
	for (const hour of beforeDueHours) {
		const scheduledAt = new Date(
			params.dueAt.getTime() - hour * 60 * 60 * 1000,
		);
		if (scheduledAt.getTime() <= Date.now()) {
			continue;
		}

		for (const userId of params.memberUserIds) {
			const channels = channelMap.get(userId) ?? [NotifChannel.EMAIL];
			const payload: TaskNotificationPayload = {
				userId,
				taskId: params.taskId,
				classId: params.classId,
				className: params.className,
				classColor: params.classColor,
				taskTitle: params.taskTitle,
				dueAt: params.dueAt.toISOString(),
				type: "TASK_DUE_REMINDER",
			};
			for (const channel of channels) {
				reminderRows.push({
					channel,
					payload: payload as unknown as object,
					scheduledAt,
					status: NotifStatus.PENDING,
					userId,
					taskId: params.taskId,
				});
			}
		}
	}

	await batchCreateAndEnqueueJobs(reminderRows);
}

export async function enqueueCommentNotifications(params: {
	taskId: string;
	classId: string;
	className: string;
	taskTitle: string;
	commentAuthorId: string;
	commentContent: string;
	replyToUserId: string | null;
}) {
	const now = new Date();

	// Get comment author name
	const author = await prisma.user.findUnique({
		where: { id: params.commentAuthorId },
		select: { nickname: true },
	});
	const authorName = author?.nickname ?? "Someone";

	// Get class color
	const cls = await prisma.class.findUnique({
		where: { id: params.classId },
		select: { color: true },
	});
	const classColor = cls?.color ?? "#7B6CB0";

	// Truncate content for email preview
	const contentPreview =
		params.commentContent.length > 500
			? `${params.commentContent.slice(0, 500)}...`
			: params.commentContent;

	let recipientUserIds: string[];

	if (params.replyToUserId) {
		// Reply → notify only the replied-to user (if not the commenter)
		if (params.replyToUserId === params.commentAuthorId) {
			return;
		}
		recipientUserIds = [params.replyToUserId];
	} else {
		// Direct comment → notify all OWNER + ADMIN members except the commenter
		const admins = await prisma.classMember.findMany({
			where: {
				classId: params.classId,
				role: { in: [ClassRole.OWNER, ClassRole.ADMIN] },
				userId: { not: params.commentAuthorId },
			},
			select: { userId: true },
		});
		recipientUserIds = admins.map((m) => m.userId);
	}

	// Batch-fetch channel preferences for all recipients.
	const allPrefs = await prisma.userNotificationPref.findMany({
		where: { userId: { in: recipientUserIds }, isEnabled: true },
		select: { userId: true, channel: true },
	});

	const channelMap = new Map<string, NotifChannel[]>();
	for (const pref of allPrefs) {
		const list = channelMap.get(pref.userId) ?? [];
		list.push(pref.channel);
		channelMap.set(pref.userId, list);
	}

	const rows: JobRow[] = [];
	for (const userId of recipientUserIds) {
		const channels = channelMap.get(userId) ?? [NotifChannel.EMAIL];
		const payload: CommentNotificationPayload = {
			userId,
			taskId: params.taskId,
			type: "TASK_COMMENT",
			className: params.className,
			classColor,
			taskTitle: params.taskTitle,
			commentAuthorName: authorName,
			commentContent: contentPreview,
			isReply: params.replyToUserId !== null,
		};
		for (const channel of channels) {
			rows.push({
				channel,
				payload: payload as unknown as object,
				scheduledAt: now,
				status: NotifStatus.PENDING,
				userId,
				taskId: params.taskId,
			});
		}
	}

	await batchCreateAndEnqueueJobs(rows);
}

function renderNotificationEmail(
	payload: NotificationPayload,
	timezone: string,
	baseUrl: string,
	appTitle: string,
	locale: AppLocale,
) {
	if (payload.type === "SITE_ANNOUNCEMENT") {
		return renderAnnouncementEmail(locale, {
			appTitle,
			baseUrl,
			title: payload.title,
			content: payload.content,
		});
	}

	if (payload.type === "TASK_COMMENT") {
		return renderCommentEmail(locale, {
			appTitle,
			baseUrl,
			taskId: payload.taskId,
			className: payload.className,
			classColor: payload.classColor,
			taskTitle: payload.taskTitle,
			commentAuthorName: payload.commentAuthorName,
			commentContent: payload.commentContent,
			isReply: payload.isReply,
		});
	}

	return renderTaskNotificationEmail(locale, {
		appTitle,
		baseUrl,
		timezone,
		taskId: payload.taskId,
		className: payload.className,
		classColor: payload.classColor,
		taskTitle: payload.taskTitle,
		dueAt: payload.dueAt,
		type: payload.type,
	});
}

async function sendWebhook(
	webhookUrl: string,
	payload: NotificationPayload,
	timezone: string,
	baseUrl: string,
	locale: AppLocale,
) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 10_000);

	try {
		let body: Record<string, unknown>;
		if (payload.type === "SITE_ANNOUNCEMENT") {
			body = {
				type: payload.type,
				title: payload.title,
				content: payload.content,
			};
		} else if (payload.type === "TASK_COMMENT") {
			body = {
				type: payload.type,
				taskId: payload.taskId,
				taskTitle: payload.taskTitle,
				className: payload.className,
				commentAuthorName: payload.commentAuthorName,
				commentContent: payload.commentContent,
				isReply: payload.isReply,
				url: `${baseUrl}/tasks/${encodeURIComponent(payload.taskId)}`,
			};
		} else {
			body = {
				type: payload.type,
				taskId: payload.taskId,
				taskTitle: payload.taskTitle,
				className: payload.className,
				dueAt: formatDueAt(payload.dueAt, timezone, locale),
				url: `${baseUrl}/tasks/${encodeURIComponent(payload.taskId)}`,
			};
		}

		const res = await fetch(webhookUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
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
	const job = await prisma.notificationJob.findUnique({
		where: { id: notificationJobId },
	});

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
		const payload = job.payload as unknown as NotificationPayload;
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
			select: { email: true, timezone: true, locale: true },
		});

		if (!user) {
			throw new Error("User not found");
		}

		const timezone = user.timezone || "UTC";
		const locale = normalizeLocale(user.locale);
		const baseUrl =
			(await getConfigValue("app.base_url")) || "http://localhost:3000";
		const appTitle =
			(await getConfigValue("app.title"))?.trim() || DEFAULT_APP_TITLE;

		if (channel === NotifChannel.EMAIL) {
			const targetEmail = user.email;
			const rendered = renderNotificationEmail(
				payload,
				timezone,
				baseUrl,
				appTitle,
				locale,
			);

			await sendEmail(
				targetEmail,
				rendered.subject,
				rendered.text,
				rendered.html,
			);
		} else if (channel === NotifChannel.WEBHOOK) {
			const webhookUrl = pref?.address;

			if (!webhookUrl) {
				throw new Error("Webhook URL not configured");
			}

			await sendWebhook(webhookUrl, payload, timezone, baseUrl, locale);
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
	title: string | null;
	content: string | null;
	readAt: Date | null;
	createdAt: Date;
}

function toNotificationItem(job: {
	id: string;
	payload: unknown;
	taskId: string | null;
	readAt: Date | null;
	createdAt: Date;
}): NotificationItemResult {
	const p = job.payload as Record<string, unknown> | null;
	const type = (p?.type as string) ?? "TASK_PUBLISHED";

	return {
		id: job.id,
		type,
		taskId: job.taskId,
		classId: (p?.classId as string) ?? null,
		taskTitle: (p?.taskTitle as string) ?? "",
		className: (p?.className as string) ?? "",
		title: (p?.title as string) ?? null,
		content: (p?.content as string) ?? null,
		readAt: job.readAt,
		createdAt: job.createdAt,
	};
}

// In-app inbox shows EMAIL channel jobs regardless of delivery status —
// a failed email send should not hide the notification from the user.
const INBOX_WHERE = (userId: string) => ({
	userId,
	channel: NotifChannel.EMAIL,
	status: { in: [NotifStatus.SENT, NotifStatus.FAILED, NotifStatus.SENDING] },
});

export async function listMyNotifications(
	userId: string,
	options: { limit: number; cursor?: string; unreadOnly: boolean },
) {
	const where = {
		...INBOX_WHERE(userId),
		...(options.unreadOnly ? { readAt: null } : {}),
	};

	const [items, unreadCount] = await Promise.all([
		prisma.notificationJob.findMany({
			where,
			orderBy: { createdAt: "desc" },
			take: options.limit + 1,
			...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
			select: {
				id: true,
				payload: true,
				taskId: true,
				readAt: true,
				createdAt: true,
			},
		}),
		prisma.notificationJob.count({
			where: { ...INBOX_WHERE(userId), readAt: null },
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

export async function markNotificationRead(
	notificationId: string,
	userId: string,
) {
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
		where: { ...INBOX_WHERE(userId), readAt: null },
		data: { readAt: new Date() },
	});

	return { updated: result.count };
}

export async function getUnreadNotificationCount(userId: string) {
	const count = await prisma.notificationJob.count({
		where: { ...INBOX_WHERE(userId), readAt: null },
	});

	return { unreadCount: count };
}
