import { NotifChannel, NotifStatus, prisma } from "@taskflow/db";

import {
	enqueueAnnouncementPublish,
	enqueueNotificationJob,
	processAnnouncementQueue,
	removeAnnouncementJob,
} from "../lib/queue.js";

const PUBLISH_DELAY_MS = 10 * 60 * 1000; // 10 minutes

// ── Types ───────────────────────────────────────────────────────────────────

export interface AnnouncementRow {
	id: string;
	title: string;
	content: string;
	status: "SCHEDULED" | "PUBLISHED" | "CANCELLED";
	scheduledAt: string;
	publishedAt: string | null;
	cancelledAt: string | null;
	createdAt: string;
}

interface AnnouncementNotificationPayload {
	userId: string;
	type: "SITE_ANNOUNCEMENT";
	announcementId: string;
	title: string;
	content: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function deriveStatus(row: {
	publishedAt: Date | null;
	cancelledAt: Date | null;
}): "SCHEDULED" | "PUBLISHED" | "CANCELLED" {
	if (row.cancelledAt) return "CANCELLED";
	if (row.publishedAt) return "PUBLISHED";
	return "SCHEDULED";
}

function toRow(a: {
	id: string;
	title: string;
	content: string;
	scheduledAt: Date;
	publishedAt: Date | null;
	cancelledAt: Date | null;
	createdAt: Date;
}): AnnouncementRow {
	return {
		id: a.id,
		title: a.title,
		content: a.content,
		status: deriveStatus(a),
		scheduledAt: a.scheduledAt.toISOString(),
		publishedAt: a.publishedAt?.toISOString() ?? null,
		cancelledAt: a.cancelledAt?.toISOString() ?? null,
		createdAt: a.createdAt.toISOString(),
	};
}

// ── CRUD ────────────────────────────────────────────────────────────────────

export type PublishMode = "immediate" | "delayed";

export async function createAnnouncement(
	title: string,
	content: string,
	publishMode: PublishMode = "delayed",
): Promise<AnnouncementRow> {
	const now = new Date();
	const scheduledAt =
		publishMode === "immediate"
			? now
			: new Date(now.getTime() + PUBLISH_DELAY_MS);

	const announcement = await prisma.siteAnnouncement.create({
		data: { title, content, scheduledAt },
	});

	if (publishMode === "immediate") {
		// Bypass Bull queue entirely — fan out synchronously so the admin
		// gets real feedback if SMTP/DB/Redis is broken.
		await publishAnnouncementFanOut(announcement.id);
		const fresh = await prisma.siteAnnouncement.findUnique({
			where: { id: announcement.id },
		});
		return toRow(fresh ?? announcement);
	}

	await enqueueAnnouncementPublish(announcement.id, scheduledAt);
	return toRow(announcement);
}

export async function cancelAnnouncement(
	id: string,
): Promise<AnnouncementRow | null> {
	const existing = await prisma.siteAnnouncement.findUnique({
		where: { id },
	});

	if (!existing) return null;
	if (existing.publishedAt || existing.cancelledAt) return toRow(existing);

	const updated = await prisma.siteAnnouncement.update({
		where: { id },
		data: { cancelledAt: new Date() },
	});

	await removeAnnouncementJob(id);

	return toRow(updated);
}

export async function listAnnouncements(): Promise<AnnouncementRow[]> {
	const rows = await prisma.siteAnnouncement.findMany({
		orderBy: { createdAt: "desc" },
		take: 50,
	});

	return rows.map(toRow);
}

// ── Fan-out (called by queue worker) ────────────────────────────────────────

export async function publishAnnouncementFanOut(
	announcementId: string,
): Promise<void> {
	const announcement = await prisma.siteAnnouncement.findUnique({
		where: { id: announcementId },
	});

	if (!announcement) return;
	if (announcement.cancelledAt) return;
	if (announcement.publishedAt) return;

	// Mark as published up-front so Bull retries don't re-fan-out and
	// create duplicate NotificationJob rows for users we already enqueued.
	await prisma.siteAnnouncement.update({
		where: { id: announcementId },
		data: { publishedAt: new Date() },
	});

	// Get all active users with their enabled notification channels
	const activeUsers = await prisma.user.findMany({
		where: { isActive: true },
		select: {
			id: true,
			notificationPrefs: {
				where: { isEnabled: true },
				select: { channel: true },
			},
		},
	});

	const now = new Date();
	let enqueued = 0;
	let enqueueFailed = 0;

	for (const user of activeUsers) {
		const channels: NotifChannel[] =
			user.notificationPrefs.length > 0
				? user.notificationPrefs.map((p) => p.channel)
				: [NotifChannel.EMAIL];

		const payload: AnnouncementNotificationPayload = {
			userId: user.id,
			type: "SITE_ANNOUNCEMENT",
			announcementId: announcement.id,
			title: announcement.title,
			content: announcement.content,
		};

		for (const channel of channels) {
			const job = await prisma.notificationJob.create({
				data: {
					channel,
					payload: payload as unknown as object,
					scheduledAt: now,
					status: NotifStatus.PENDING,
					userId: user.id,
				},
			});

			try {
				await enqueueNotificationJob(job.id, now);
				enqueued++;
			} catch (err) {
				enqueueFailed++;
				// Keep PENDING row for recovery, but surface the error — silent
				// failures here were the reason announcements appeared "published"
				// with no emails sent.
				console.error(
					`[announcement] Failed to enqueue notification job ${job.id} for announcement ${announcement.id}:`,
					err,
				);
			}
		}
	}

	console.info(
		`[announcement] Fan-out complete for ${announcement.id}: ${enqueued} queued, ${enqueueFailed} failed, ${activeUsers.length} users`,
	);
}

// ── Worker ──────────────────────────────────────────────────────────────────

export function startAnnouncementWorker() {
	processAnnouncementQueue(async (payload) => {
		if (!payload.announcementId) return;
		await publishAnnouncementFanOut(payload.announcementId);
	});
}
