import Bull, { type Queue } from "bull";

import { loadEnv } from "./env.js";

let queue: Queue | null = null;

function getQueue() {
	if (queue) {
		return queue;
	}

	const env = loadEnv();
	queue = new Bull("taskflow-notifications", env.redisQueueUrl);

	return queue;
}

export interface NotificationQueueJob {
	notificationJobId: string;
}

export interface AnnouncementQueueJob {
	announcementId: string;
}

export async function enqueueNotificationJob(
	notificationJobId: string,
	scheduledAt: Date,
) {
	const delay = Math.max(0, scheduledAt.getTime() - Date.now());
	const q = getQueue();

	await q.add(
		{
			notificationJobId,
		},
		{
			jobId: notificationJobId,
			delay,
			removeOnComplete: true,
			attempts: 3,
			backoff: {
				type: "exponential",
				delay: 1_000,
			},
		},
	);
}

export function processNotificationQueue(
	processor: (job: NotificationQueueJob) => Promise<void>,
) {
	const q = getQueue();

	q.process(async (job) => {
		await processor(job.data as NotificationQueueJob);
	});
}

const ANNOUNCEMENT_JOB_NAME = "announcement-publish";

export async function enqueueAnnouncementPublish(
	announcementId: string,
	scheduledAt: Date,
) {
	const delay = Math.max(0, scheduledAt.getTime() - Date.now());
	const q = getQueue();

	await q.add(
		ANNOUNCEMENT_JOB_NAME,
		{ announcementId } satisfies AnnouncementQueueJob,
		{
			jobId: `announcement-${announcementId}`,
			delay,
			removeOnComplete: true,
			attempts: 3,
			backoff: {
				type: "exponential",
				delay: 1_000,
			},
		},
	);
}

export async function removeAnnouncementJob(announcementId: string) {
	const q = getQueue();
	const job = await q.getJob(`announcement-${announcementId}`);
	if (job) {
		await job.remove();
	}
}

export function processAnnouncementQueue(
	processor: (job: AnnouncementQueueJob) => Promise<void>,
) {
	const q = getQueue();

	q.process(ANNOUNCEMENT_JOB_NAME, async (job) => {
		await processor(job.data as AnnouncementQueueJob);
	});
}
