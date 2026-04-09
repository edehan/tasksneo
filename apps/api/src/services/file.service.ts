import { ClassRole, prisma } from "@taskflow/db";

import { AppError } from "../lib/errors.js";
import { toAttachmentMeta } from "../lib/http.js";
import { getPresignedUrl, removeObject } from "../lib/storage.js";

async function isClassMember(classId: string, userId: string) {
	const membership = await prisma.classMember.findUnique({
		where: {
			classId_userId: {
				classId,
				userId,
			},
		},
	});

	return membership;
}

async function assertTaskAttachmentAccess(taskId: string, userId: string) {
	const task = await prisma.task.findUnique({
		where: { id: taskId },
		select: {
			classId: true,
			createdBy: true,
			isPublished: true,
		},
	});

	if (!task) {
		throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
	}

	if (task.classId) {
		const membership = await isClassMember(task.classId, userId);

		if (!membership) {
			throw new AppError(403, "FORBIDDEN", "No permission to access task file");
		}

		if (!task.isPublished && membership.role === ClassRole.MEMBER) {
			throw new AppError(403, "FORBIDDEN", "No permission to access task file");
		}

		return;
	}

	const submission = await prisma.submission.findUnique({
		where: {
			taskId_userId: {
				taskId,
				userId,
			},
		},
	});

	if (!submission && task.createdBy !== userId) {
		throw new AppError(403, "FORBIDDEN", "No permission to access task file");
	}
}

async function assertSubmissionAttachmentAccess(
	submissionId: string,
	userId: string,
) {
	const submission = await prisma.submission.findUnique({
		where: { id: submissionId },
		include: {
			task: {
				select: {
					classId: true,
				},
			},
		},
	});

	if (!submission) {
		throw new AppError(404, "SUBMISSION_NOT_FOUND", "Submission not found");
	}

	if (submission.userId === userId) {
		return;
	}

	if (!submission.task.classId) {
		throw new AppError(
			403,
			"FORBIDDEN",
			"No permission to access submission file",
		);
	}

	const membership = await isClassMember(submission.task.classId, userId);

	if (
		!membership ||
		(membership.role !== ClassRole.OWNER && membership.role !== ClassRole.ADMIN)
	) {
		throw new AppError(
			403,
			"FORBIDDEN",
			"No permission to access submission file",
		);
	}
}

export async function getAuthorizedFileUrl(fileKey: string, userId: string) {
	const attachment = await prisma.attachment.findUnique({
		where: { fileKey },
		select: {
			taskId: true,
			submissionId: true,
			classId: true,
			avatarUserId: true,
		},
	});

	if (!attachment) {
		throw new AppError(404, "FILE_NOT_FOUND", "File not found");
	}

	if (attachment.taskId) {
		await assertTaskAttachmentAccess(attachment.taskId, userId);
	} else if (attachment.submissionId) {
		await assertSubmissionAttachmentAccess(attachment.submissionId, userId);
	} else if (attachment.classId) {
		const membership = await isClassMember(attachment.classId, userId);

		if (!membership) {
			throw new AppError(
				403,
				"FORBIDDEN",
				"No permission to access class file",
			);
		}
	} else if (attachment.avatarUserId) {
		if (attachment.avatarUserId !== userId) {
			throw new AppError(403, "FORBIDDEN", "No permission to access avatar");
		}
	}

	return getPresignedUrl(fileKey, 300);
}

export async function deleteAttachment(attachmentId: string, userId: string) {
	const attachment = await prisma.attachment.findUnique({
		where: { id: attachmentId },
		select: {
			id: true,
			fileKey: true,
			taskId: true,
			submissionId: true,
			classId: true,
			avatarUserId: true,
		},
	});

	if (!attachment) {
		throw new AppError(404, "FILE_NOT_FOUND", "Attachment not found");
	}

	// Check permission: must be uploader/admin
	if (attachment.taskId) {
		const task = await prisma.task.findUnique({
			where: { id: attachment.taskId },
			select: { classId: true },
		});

		if (task?.classId) {
			const membership = await isClassMember(task.classId, userId);

			if (
				!membership ||
				(membership.role !== ClassRole.OWNER &&
					membership.role !== ClassRole.ADMIN)
			) {
				throw new AppError(
					403,
					"FORBIDDEN",
					"No permission to delete this attachment",
				);
			}
		}
	} else if (attachment.submissionId) {
		const submission = await prisma.submission.findUnique({
			where: { id: attachment.submissionId },
			select: { userId: true },
		});

		if (!submission || submission.userId !== userId) {
			throw new AppError(
				403,
				"FORBIDDEN",
				"No permission to delete this attachment",
			);
		}
	} else {
		throw new AppError(
			403,
			"FORBIDDEN",
			"Cannot delete this type of attachment",
		);
	}

	await removeObject(attachment.fileKey);
	await prisma.attachment.delete({ where: { id: attachment.id } });
}

export async function updateTaskAttachmentVisibility(
	attachmentId: string,
	userId: string,
	isVisible: boolean,
) {
	const attachment = await prisma.attachment.findUnique({
		where: { id: attachmentId },
		select: {
			id: true,
			taskId: true,
			submissionId: true,
			classId: true,
			avatarUserId: true,
		},
	});

	if (!attachment) {
		throw new AppError(404, "FILE_NOT_FOUND", "Attachment not found");
	}

	if (
		!attachment.taskId ||
		attachment.submissionId ||
		attachment.classId ||
		attachment.avatarUserId
	) {
		throw new AppError(
			400,
			"VALIDATION_ERROR",
			"Only task attachments support visibility changes",
		);
	}

	const task = await prisma.task.findUnique({
		where: { id: attachment.taskId },
		select: { classId: true },
	});

	if (!task?.classId) {
		throw new AppError(
			403,
			"FORBIDDEN",
			"Only class task attachments can be updated",
		);
	}

	const membership = await isClassMember(task.classId, userId);

	if (
		!membership ||
		(membership.role !== ClassRole.OWNER && membership.role !== ClassRole.ADMIN)
	) {
		throw new AppError(
			403,
			"FORBIDDEN",
			"No permission to update this attachment",
		);
	}

	const updated = await prisma.attachment.update({
		where: { id: attachment.id },
		data: { isVisible },
	});

	return toAttachmentMeta(updated);
}
