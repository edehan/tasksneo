import { getRedisClient } from "../lib/redis.js";

const TASK_DRAFT_MARKDOWN_TTL_SECONDS = 60 * 60 * 24 * 3;

function getTaskDraftMarkdownKey(taskId: string) {
	return `task:draft:markdown:${taskId}`;
}

export async function setTaskDraftMarkdown(taskId: string, markdown: string) {
	try {
		const redis = getRedisClient();
		await redis.set(
			getTaskDraftMarkdownKey(taskId),
			markdown,
			"EX",
			TASK_DRAFT_MARKDOWN_TTL_SECONDS,
		);
	} catch {
		// Redis should not block the main flow.
	}
}

export async function getTaskDraftMarkdown(
	taskId: string,
): Promise<string | null> {
	try {
		const redis = getRedisClient();
		return redis.get(getTaskDraftMarkdownKey(taskId));
	} catch {
		return null;
	}
}

export async function deleteTaskDraftMarkdown(taskId: string) {
	try {
		const redis = getRedisClient();
		await redis.del(getTaskDraftMarkdownKey(taskId));
	} catch {
		// Ignore cache cleanup errors.
	}
}
