import { prisma } from "@taskflow/db";

import { AppError } from "../lib/errors.js";
import { toComment } from "../lib/http.js";
import { enqueueCommentNotifications } from "./notification.service.js";
import { assertTaskAccess } from "./task.service.js";

const COMMENT_INCLUDE = {
	author: {
		select: {
			id: true,
			nickname: true,
			email: true,
		},
	},
	replyTo: {
		select: {
			id: true,
			nickname: true,
		},
	},
} as const;

export async function listTaskComments(taskId: string, userId: string) {
	await assertTaskAccess(taskId, userId);

	const comments = await prisma.comment.findMany({
		where: { taskId },
		orderBy: { createdAt: "asc" },
		include: COMMENT_INCLUDE,
	});

	return comments.map(toComment);
}

export async function createComment(
	taskId: string,
	userId: string,
	content: string,
	replyToId?: string | null,
) {
	const { task, classMembership } = await assertTaskAccess(taskId, userId);

	if (task.deletedAt) {
		throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
	}

	if (!task.isPublished) {
		throw new AppError(400, "TASK_NOT_PUBLISHED", "Cannot comment on unpublished tasks");
	}

	if (replyToId) {
		const replyUser = await prisma.user.findUnique({
			where: { id: replyToId },
			select: { id: true },
		});
		if (!replyUser) {
			throw new AppError(404, "USER_NOT_FOUND", "Reply target user not found");
		}
	}

	const comment = await prisma.comment.create({
		data: {
			content,
			taskId,
			authorId: userId,
			replyToId: replyToId ?? null,
		},
		include: COMMENT_INCLUDE,
	});

	// Enqueue notifications (fire-and-forget)
	if (task.classId && classMembership) {
		void enqueueCommentNotifications({
			taskId,
			classId: task.classId,
			className: task.class?.name ?? "",
			taskTitle: task.title,
			commentAuthorId: userId,
			commentContent: content,
			replyToUserId: replyToId ?? null,
		}).catch(() => {
			// Notification failure should not break comment creation
		});
	}

	return toComment(comment);
}
