import { Job, Queue, Worker } from "bullmq";
import { Redis } from "ioredis";

import { loadEnv } from "./env.js";

let queue: Queue | null = null;
let redisConnection: Redis | null = null;

// Single shared worker + handler registry.
// BullMQ Workers compete for all jobs on a queue regardless of job name — multiple
// Workers on the same queue would silently consume each other's jobs. We avoid this
// by maintaining one Worker that dispatches to registered per-name handlers.
const jobHandlers = new Map<string, (job: Job) => Promise<void>>();
let sharedWorker: Worker | null = null;

function getRedisConnection() {
	if (redisConnection) {
		return redisConnection;
	}

	const env = loadEnv();
	redisConnection = new Redis(env.redisUrl, {
		maxRetriesPerRequest: null,
	});
	return redisConnection;
}

function getQueue() {
	if (queue) {
		return queue;
	}

	queue = new Queue("taskflow-notifications", {
		connection: getRedisConnection(),
	});

	return queue;
}

function getOrCreateSharedWorker() {
	if (sharedWorker) return sharedWorker;

	const q = getQueue();
	sharedWorker = new Worker(
		q.name,
		async (job) => {
			const handler = jobHandlers.get(job.name);
			if (handler) {
				await handler(job);
			}
		},
		{ connection: getRedisConnection() },
	);
	return sharedWorker;
}

export interface NotificationQueueJob {
	notificationJobId: string;
}

export interface AnnouncementQueueJob {
	announcementId: string;
}

const JOB_NAME_NOTIFICATION = "notification-send";
const JOB_NAME_ANNOUNCEMENT = "announcement-publish";
const JOB_NAME_SESSION_CLEANUP = "session-cleanup";

export async function enqueueNotificationJob(
	notificationJobId: string,
	scheduledAt: Date,
) {
	const delay = Math.max(0, scheduledAt.getTime() - Date.now());
	const q = getQueue();

	await q.add(
		JOB_NAME_NOTIFICATION,
		{
			notificationJobId,
		} satisfies NotificationQueueJob,
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
	jobHandlers.set(JOB_NAME_NOTIFICATION, async (job) => {
		await processor(job.data as NotificationQueueJob);
	});
	getOrCreateSharedWorker();
}

export async function enqueueAnnouncementPublish(
	announcementId: string,
	scheduledAt: Date,
) {
	const delay = Math.max(0, scheduledAt.getTime() - Date.now());
	const q = getQueue();

	await q.add(
		JOB_NAME_ANNOUNCEMENT,
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
	const job = await Job.fromId(q, `announcement-${announcementId}`);
	if (job) {
		await job.remove();
	}
}

export function processAnnouncementQueue(
	processor: (job: AnnouncementQueueJob) => Promise<void>,
) {
	jobHandlers.set(JOB_NAME_ANNOUNCEMENT, async (job) => {
		await processor(job.data as AnnouncementQueueJob);
	});
	getOrCreateSharedWorker();
}

// ── Session cleanup cron ────────────────────────────────────────────────────

const SESSION_CLEANUP_JOB_ID = "session-cleanup-daily";
const SESSION_CLEANUP_CRON = "0 3 * * *"; // every day at 03:00 local time

/**
 * Register the daily session cleanup cron. Safe to call repeatedly — BullMQ
 * deduplicates the repeatable entry by jobId + cron.
 */
export async function scheduleSessionCleanupCron() {
	const q = getQueue();

	// Strip any prior repeatable entries for this job so changing the cron
	// expression between deploys doesn't leave the old schedule orphaned.
	const existing = await q.getRepeatableJobs();
	for (const entry of existing) {
		if (entry.name === JOB_NAME_SESSION_CLEANUP) {
			await q.removeRepeatableByKey(entry.key);
		}
	}

	await q.add(
		JOB_NAME_SESSION_CLEANUP,
		{},
		{
			jobId: SESSION_CLEANUP_JOB_ID,
			repeat: { pattern: SESSION_CLEANUP_CRON },
			removeOnComplete: true,
			removeOnFail: true,
		},
	);
}

export function processSessionCleanupQueue(processor: () => Promise<void>) {
	jobHandlers.set(JOB_NAME_SESSION_CLEANUP, async () => {
		await processor();
	});
	getOrCreateSharedWorker();
}

// ── Queue introspection for admin panel ────────────────────────────────────

export async function getQueueStats() {
	const q = getQueue();

	const [jobCounts, delayed, failed, repeatable] = await Promise.all([
		q.getJobCounts("waiting", "active", "delayed", "failed", "paused"),
		q.getJobs(["delayed"], 0, 29),
		q.getJobs(["failed"], 0, 29),
		q.getRepeatableJobs(),
	]);

	return {
		jobCounts,
		delayedJobs: delayed.map((j) => ({
			id: j.id ?? "",
			name: j.name,
			data: j.data as Record<string, unknown>,
			processAt: new Date(j.timestamp + j.delay).toISOString(),
		})),
		failedJobs: failed.map((j) => ({
			id: j.id ?? "",
			name: j.name,
			failedReason: j.failedReason ?? null,
			attemptsMade: j.attemptsMade,
			timestamp: new Date(j.timestamp).toISOString(),
		})),
		repeatableJobs: repeatable.map((r) => ({
			key: r.key,
			name: r.name,
			pattern: r.pattern ?? "",
			next: r.next ? new Date(r.next).toISOString() : null,
		})),
	};
}
