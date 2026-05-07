import { ClassRole, prisma } from "@taskflow/db";

import { cacheDel, cacheGetOrSet, cacheKeys } from "../lib/cache.js";
import { AppError } from "../lib/errors.js";

const TASK_STATS_TTL_SECONDS = 60;

interface TaskStats {
	memberCount: number;
	viewedCount: number;
	submittedCount: number;
}

async function loadTaskStats(
	taskId: string,
	classId: string,
): Promise<TaskStats> {
	const [memberCount, viewedCount, submittedCount] = await Promise.all([
		prisma.classMember.count({ where: { classId } }),
		prisma.taskUserState.count({
			where: { taskId, viewedAt: { not: null } },
		}),
		prisma.submission.count({ where: { taskId } }),
	]);
	return { memberCount, viewedCount, submittedCount };
}

import {
	emailToAvatarHash,
	toAttachmentMeta,
	toSubmission,
	toTaskSummary,
	toTaskUserState,
} from "../lib/http.js";
import { enqueueTaskPublishedNotifications } from "./notification.service.js";
import { getMembershipOrThrow, requireOwnerOrAdmin } from "./policy.service.js";
import {
	hardDeleteTask,
	removeSubmissionAttachments,
	softDeleteTask,
	tryHardDeleteOrphanTask,
} from "./task-cleanup.service.js";

interface CreateTaskInput {
	title: string;
	description?: string | null;
	sourceText?: string | null;
	startAt?: string | null;
	dueAt?: string | null;
	allowLateSubmission?: boolean;
	blockedBy?: string[];
}

interface UpdateTaskInput {
	title?: string;
	description?: string | null;
	sourceText?: string | null;
	startAt?: string | null;
	dueAt?: string | null;
	allowLateSubmission?: boolean;
	blockedBy?: string[];
}

interface CreateTaskDraftInput {
	title?: string;
	description?: string | null;
	sourceText?: string | null;
	startAt?: string | null;
	dueAt?: string | null;
	allowLateSubmission?: boolean;
	blockedBy?: string[];
}

interface UpdateTaskUserStateInput {
	tags?: string[];
	sortOrder?: number;
}

function parseDate(value?: string | null): Date | null | undefined {
	if (value === undefined) {
		return undefined;
	}

	if (value === null || value === "") {
		return null;
	}

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		throw new AppError(400, "INVALID_DATE", "Invalid datetime format");
	}

	return date;
}

export async function assertTaskAccess(taskId: string, userId: string) {
	const task = await prisma.task.findUnique({
		where: { id: taskId },
		include: {
			class: {
				select: {
					id: true,
					name: true,
				},
			},
		},
	});

	if (!task) {
		throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
	}

	if (task.classId) {
		const membership = await getMembershipOrThrow(task.classId, userId);

		if (!task.isPublished && membership.role === ClassRole.MEMBER) {
			throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
		}

		return {
			task,
			classMembership: membership,
		};
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
		throw new AppError(403, "FORBIDDEN", "You do not have access to this task");
	}

	return {
		task,
		classMembership: null,
	};
}

export async function assertSubmissionMutationAllowed(
	taskId: string,
	userId: string,
) {
	const { task } = await assertTaskAccess(taskId, userId);

	if (
		task.dueAt &&
		!task.allowLateSubmission &&
		task.dueAt.getTime() < Date.now()
	) {
		throw new AppError(
			403,
			"LATE_SUBMISSION_CLOSED",
			"Submission deadline has passed",
		);
	}

	return task;
}

async function getTaskWithUserState(taskId: string, userId: string) {
	const [task, state, submission] = await Promise.all([
		prisma.task.findUnique({
			where: { id: taskId },
			include: {
				class: {
					select: {
						name: true,
					},
				},
			},
		}),
		prisma.taskUserState.findUnique({
			where: {
				taskId_userId: {
					taskId,
					userId,
				},
			},
		}),
		prisma.submission.findUnique({
			where: {
				taskId_userId: {
					taskId,
					userId,
				},
			},
			select: { firstSubmittedAt: true },
		}),
	]);

	if (!task) {
		throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
	}

	return toTaskSummary(task, state, submission?.firstSubmittedAt ?? null);
}

export async function listClassTasks(classId: string, userId: string) {
	await getMembershipOrThrow(classId, userId);

	const [tasks, states, submissions, memberCount, submissionCounts] =
		await Promise.all([
			prisma.task.findMany({
				where: {
					classId,
					deletedAt: null,
					isPublished: true,
				},
				include: {
					class: {
						select: {
							name: true,
						},
					},
				},
				orderBy: {
					createdAt: "desc",
				},
			}),
			prisma.taskUserState.findMany({
				where: {
					userId,
					task: {
						classId,
						deletedAt: null,
						isPublished: true,
					},
				},
			}),
			prisma.submission.findMany({
				where: {
					userId,
					task: {
						classId,
						deletedAt: null,
						isPublished: true,
					},
				},
				select: {
					taskId: true,
					firstSubmittedAt: true,
				},
			}),
			prisma.classMember.count({ where: { classId } }),
			prisma.submission.groupBy({
				by: ["taskId"],
				_count: true,
				where: {
					task: { classId, deletedAt: null, isPublished: true },
				},
			}),
		]);

	const stateMap = new Map(states.map((state) => [state.taskId, state]));
	const submissionMap = new Map(
		submissions.map((s) => [s.taskId, s.firstSubmittedAt]),
	);
	const subCountMap = new Map(
		submissionCounts.map((s) => [s.taskId, s._count]),
	);

	return tasks.map((task) => ({
		...toTaskSummary(
			task,
			stateMap.get(task.id) ?? null,
			submissionMap.get(task.id) ?? null,
		),
		submittedCount: subCountMap.get(task.id) ?? 0,
		memberCount,
	}));
}

export async function listMyTasks(userId: string) {
	const memberships = await prisma.classMember.findMany({
		where: { userId },
		select: { classId: true },
		orderBy: { joinedAt: "asc" },
	});
	const classIds = memberships.map((membership) => membership.classId);

	if (classIds.length === 0) {
		return [];
	}

	const tasks = await prisma.task.findMany({
		where: {
			deletedAt: null,
			isPublished: true,
			classId: { in: classIds },
		},
		include: {
			class: {
				select: {
					name: true,
					color: true,
				},
			},
		},
		orderBy: {
			createdAt: "desc",
		},
	});
	const taskIds = tasks.map((task) => task.id);

	if (taskIds.length === 0) {
		return [];
	}

	const [states, submissions, memberCounts, submissionCounts] =
		await Promise.all([
			prisma.taskUserState.findMany({
				where: {
					userId,
					taskId: { in: taskIds },
				},
			}),
			prisma.submission.findMany({
				where: {
					userId,
					taskId: { in: taskIds },
				},
				select: {
					taskId: true,
					firstSubmittedAt: true,
				},
			}),
			prisma.classMember.groupBy({
				by: ["classId"],
				_count: true,
				where: { classId: { in: classIds } },
			}),
			prisma.submission.groupBy({
				by: ["taskId"],
				_count: true,
				where: { taskId: { in: taskIds } },
			}),
		]);

	const stateMap = new Map(states.map((state) => [state.taskId, state]));
	const submissionMap = new Map(
		submissions.map((s) => [s.taskId, s.firstSubmittedAt]),
	);
	const memberCountMap = new Map(
		memberCounts.map((m) => [m.classId, m._count]),
	);
	const subCountMap = new Map(
		submissionCounts.map((s) => [s.taskId, s._count]),
	);

	return tasks.map((task) => ({
		...toTaskSummary(
			task,
			stateMap.get(task.id) ?? null,
			submissionMap.get(task.id) ?? null,
		),
		classColor: task.class?.color ?? null,
		submittedCount: subCountMap.get(task.id) ?? 0,
		memberCount: task.classId ? (memberCountMap.get(task.classId) ?? 0) : 0,
	}));
}

export async function createClassTask(
	classId: string,
	userId: string,
	input: CreateTaskInput,
) {
	const membership = await getMembershipOrThrow(classId, userId);
	requireOwnerOrAdmin(membership);

	const task = await prisma.task.create({
		data: {
			classId,
			createdBy: userId,
			title: input.title,
			description: input.description ?? null,
			sourceText: input.sourceText ?? null,
			startAt: parseDate(input.startAt) ?? new Date(),
			dueAt: parseDate(input.dueAt),
			allowLateSubmission: input.allowLateSubmission ?? true,
			blockedBy: input.blockedBy ?? [],
			isPublished: true,
			publishedAt: new Date(),
		},
		include: {
			class: {
				select: {
					name: true,
					color: true,
				},
			},
		},
	});

	const memberIds = await prisma.classMember.findMany({
		where: { classId },
		select: { userId: true },
	});

	await enqueueTaskPublishedNotifications({
		taskId: task.id,
		classId,
		className: task.class?.name ?? "",
		classColor: task.class?.color ?? "#7B6CB0",
		taskTitle: task.title,
		dueAt: task.dueAt,
		memberUserIds: memberIds.map((item) => item.userId),
	});

	return toTaskSummary(task, null);
}

export async function createClassTaskDraft(
	classId: string,
	userId: string,
	input: CreateTaskDraftInput,
) {
	const membership = await getMembershipOrThrow(classId, userId);
	requireOwnerOrAdmin(membership);

	const title = input.title?.trim() || "Untitled Draft";

	const task = await prisma.task.create({
		data: {
			classId,
			createdBy: userId,
			title,
			description: input.description ?? null,
			sourceText: input.sourceText ?? null,
			startAt: parseDate(input.startAt) ?? new Date(),
			dueAt: parseDate(input.dueAt),
			allowLateSubmission: input.allowLateSubmission ?? true,
			blockedBy: input.blockedBy ?? [],
			isPublished: false,
			publishedAt: null,
		},
		include: {
			class: {
				select: {
					name: true,
				},
			},
		},
	});

	return toTaskSummary(task, null);
}

export async function findMyClassDraft(classId: string, userId: string) {
	const membership = await getMembershipOrThrow(classId, userId);
	requireOwnerOrAdmin(membership);

	const draft = await prisma.task.findFirst({
		where: {
			classId,
			createdBy: userId,
			isPublished: false,
			deletedAt: null,
		},
		include: {
			class: { select: { name: true } },
			attachments: true,
		},
		orderBy: { createdAt: "desc" },
	});

	if (!draft) return null;

	return {
		...toTaskSummary(draft, null),
		attachments: draft.attachments.map(toAttachmentMeta),
	};
}

export async function getTaskDetail(taskId: string, userId: string) {
	const { task, classMembership } = await assertTaskAccess(taskId, userId);

	const shouldLoadStats =
		task.isPublished &&
		!!classMembership &&
		(classMembership.role === ClassRole.OWNER ||
			classMembership.role === ClassRole.ADMIN) &&
		!!task.classId;

	const [userState, attachments, stats] = await Promise.all([
		prisma.taskUserState.findUnique({
			where: {
				taskId_userId: {
					taskId,
					userId,
				},
			},
		}),
		prisma.attachment.findMany({
			where:
				classMembership?.role === ClassRole.MEMBER
					? { taskId, isVisible: true }
					: { taskId },
		}),
		shouldLoadStats && task.classId
			? cacheGetOrSet<TaskStats>(
					cacheKeys.taskStats(taskId),
					TASK_STATS_TTL_SECONDS,
					() => loadTaskStats(taskId, task.classId as string),
				)
			: null,
	]);

	return {
		...toTaskSummary(task, userState),
		description: task.description,
		attachments: attachments.map(toAttachmentMeta),
		stats,
	};
}

export async function updateTask(
	taskId: string,
	userId: string,
	input: UpdateTaskInput,
) {
	const { task, classMembership } = await assertTaskAccess(taskId, userId);

	if (!classMembership) {
		throw new AppError(403, "FORBIDDEN", "Only class admin can update task");
	}

	requireOwnerOrAdmin(classMembership);

	await prisma.task.update({
		where: { id: taskId },
		data: {
			title: input.title,
			description: input.description,
			sourceText: input.sourceText,
			startAt: parseDate(input.startAt),
			dueAt: parseDate(input.dueAt),
			allowLateSubmission: input.allowLateSubmission,
			blockedBy: input.blockedBy,
			updatedAt: new Date(),
		},
	});

	return getTaskWithUserState(task.id, userId);
}

export async function publishTask(
	taskId: string,
	userId: string,
	input: UpdateTaskInput,
) {
	const { task, classMembership } = await assertTaskAccess(taskId, userId);

	if (!classMembership || !task.classId) {
		throw new AppError(403, "FORBIDDEN", "Only class admin can publish task");
	}

	requireOwnerOrAdmin(classMembership);

	if (task.isPublished) {
		return getTaskWithUserState(task.id, userId);
	}

	const finalTitle = input.title?.trim() || task.title.trim();

	if (!finalTitle) {
		throw new AppError(
			400,
			"VALIDATION_ERROR",
			"title is required for publish",
		);
	}

	const publishedAt = new Date();

	const updatedTask = await prisma.task.update({
		where: { id: taskId },
		data: {
			title: finalTitle,
			description:
				input.description === undefined ? task.description : input.description,
			sourceText:
				input.sourceText === undefined ? task.sourceText : input.sourceText,
			startAt: parseDate(input.startAt),
			dueAt: parseDate(input.dueAt),
			allowLateSubmission: input.allowLateSubmission,
			blockedBy: input.blockedBy,
			isPublished: true,
			publishedAt,
			updatedAt: publishedAt,
		},
		include: {
			class: {
				select: {
					name: true,
					color: true,
				},
			},
		},
	});

	const memberIds = await prisma.classMember.findMany({
		where: { classId: task.classId },
		select: { userId: true },
	});

	await enqueueTaskPublishedNotifications({
		taskId: updatedTask.id,
		classId: task.classId,
		className: updatedTask.class?.name ?? "",
		classColor: updatedTask.class?.color ?? "#7B6CB0",
		taskTitle: updatedTask.title,
		dueAt: updatedTask.dueAt,
		memberUserIds: memberIds.map((item) => item.userId),
	});

	return getTaskWithUserState(updatedTask.id, userId);
}

export async function deleteTask(taskId: string, userId: string) {
	const { task, classMembership } = await assertTaskAccess(taskId, userId);

	if (!classMembership) {
		throw new AppError(403, "FORBIDDEN", "Only class admin can delete task");
	}

	requireOwnerOrAdmin(classMembership);

	const submissionCount = await prisma.submission.count({ where: { taskId } });

	if (submissionCount === 0) {
		await hardDeleteTask(taskId);
		return;
	}

	await softDeleteTask(taskId, false);

	if (!task.classId) {
		await tryHardDeleteOrphanTask(taskId);
	}
}

export async function markTaskViewed(taskId: string, userId: string) {
	await assertTaskAccess(taskId, userId);

	const viewedAt = new Date();

	const updated = await prisma.taskUserState.updateMany({
		where: {
			taskId,
			userId,
			viewedAt: null,
		},
		data: {
			viewedAt,
		},
	});

	if (updated.count > 0) {
		await cacheDel(cacheKeys.taskStats(taskId));
		return;
	}

	const created = await prisma.taskUserState.createMany({
		data: [
			{
				taskId,
				userId,
				viewedAt,
				tags: [],
			},
		],
		skipDuplicates: true,
	});

	if (created.count > 0) {
		await cacheDel(cacheKeys.taskStats(taskId));
	}
}

export async function updateTaskUserState(
	taskId: string,
	userId: string,
	input: UpdateTaskUserStateInput,
) {
	await assertTaskAccess(taskId, userId);

	const state = await prisma.taskUserState.upsert({
		where: {
			taskId_userId: {
				taskId,
				userId,
			},
		},
		update: {
			tags: input.tags,
			sortOrder: input.sortOrder,
		},
		create: {
			taskId,
			userId,
			tags: input.tags ?? [],
			sortOrder: input.sortOrder ?? 0,
		},
	});

	return toTaskUserState(state);
}

export async function listTaskSubmissions(taskId: string, userId: string) {
	const { task, classMembership } = await assertTaskAccess(taskId, userId);

	if (!classMembership || !task.classId) {
		throw new AppError(
			403,
			"FORBIDDEN",
			"Only class admin can view all submissions",
		);
	}

	requireOwnerOrAdmin(classMembership);

	const rows = await prisma.classMember.findMany({
		where: {
			classId: task.classId,
		},
		include: {
			user: {
				include: {
					school: {
						select: {
							name: true,
						},
					},
				},
			},
			class: {
				select: {
					name: true,
				},
			},
		},
		orderBy: {
			joinedAt: "asc",
		},
	});

	const submissions = await prisma.submission.findMany({
		where: { taskId },
	});
	const states = await prisma.taskUserState.findMany({
		where: { taskId },
		select: {
			userId: true,
			viewedAt: true,
		},
	});

	const submissionMap = new Map(
		submissions.map((submission) => [submission.userId, submission]),
	);
	const stateMap = new Map(states.map((state) => [state.userId, state]));

	return rows.map((row) => {
		const submission = submissionMap.get(row.userId);
		const state = stateMap.get(row.userId);

		return {
			userId: row.userId,
			nickname: row.user.nickname,
			avatarHash: emailToAvatarHash(row.user.email),
			schoolName: row.user.school?.name ?? null,
			studentId: row.user.studentId,
			role: row.role,
			viewedAt: state?.viewedAt?.toISOString() ?? null,
			submitted: Boolean(submission),
			submission: submission ? toSubmission(submission) : null,
			attachments: [],
		};
	});
}

export async function getSubmissionById(submissionId: string, userId: string) {
	const submission = await prisma.submission.findUnique({
		where: { id: submissionId },
		include: { attachments: true },
	});

	if (!submission) {
		throw new AppError(404, "SUBMISSION_NOT_FOUND", "Submission not found");
	}

	const { classMembership } = await assertTaskAccess(submission.taskId, userId);

	if (!classMembership) {
		throw new AppError(
			403,
			"FORBIDDEN",
			"Only class admin can view submission detail",
		);
	}

	requireOwnerOrAdmin(classMembership);

	return {
		...toSubmission(submission),
		attachments: submission.attachments.map(toAttachmentMeta),
	};
}

export async function getTaskSubmissionDetail(
	taskId: string,
	submissionId: string,
	userId: string,
) {
	const { task, classMembership } = await assertTaskAccess(taskId, userId);

	if (!classMembership || !task.classId) {
		throw new AppError(
			403,
			"FORBIDDEN",
			"Only class admin can view submission detail",
		);
	}

	requireOwnerOrAdmin(classMembership);

	const submission = await prisma.submission.findUnique({
		where: {
			id: submissionId,
		},
		include: {
			attachments: true,
		},
	});

	if (!submission || submission.taskId !== taskId) {
		throw new AppError(404, "SUBMISSION_NOT_FOUND", "Submission not found");
	}

	return {
		...toSubmission(submission),
		attachments: submission.attachments.map(toAttachmentMeta),
	};
}

export async function getMySubmission(taskId: string, userId: string) {
	await assertTaskAccess(taskId, userId);

	const submission = await prisma.submission.findUnique({
		where: {
			taskId_userId: {
				taskId,
				userId,
			},
		},
		include: {
			attachments: true,
		},
	});

	if (!submission) {
		return null;
	}

	return {
		...toSubmission(submission),
		attachments: submission.attachments.map(toAttachmentMeta),
	};
}

async function ensureSubmission(taskId: string, userId: string) {
	const existingSubmission = await prisma.submission.findUnique({
		where: {
			taskId_userId: {
				taskId,
				userId,
			},
		},
		select: {
			id: true,
		},
	});

	if (existingSubmission) {
		return existingSubmission.id;
	}

	const submission = await prisma.submission.create({
		data: {
			taskId,
			userId,
		},
		select: {
			id: true,
		},
	});
	await cacheDel(cacheKeys.taskStats(taskId));

	return submission.id;
}

async function markTaskSubmissionTouched(taskId: string, userId: string) {
	await prisma.taskUserState.upsert({
		where: {
			taskId_userId: {
				taskId,
				userId,
			},
		},
		update: {},
		create: {
			taskId,
			userId,
			tags: [],
			viewedAt: new Date(),
		},
	});
}

async function getSubmissionDetailOrThrow(submissionId: string) {
	const submission = await prisma.submission.findUnique({
		where: { id: submissionId },
		include: { attachments: true },
	});

	if (!submission) {
		throw new AppError(404, "SUBMISSION_NOT_FOUND", "Submission not found");
	}

	return {
		...toSubmission(submission),
		attachments: submission.attachments.map(toAttachmentMeta),
	};
}

export async function upsertMySubmissionContent(
	taskId: string,
	userId: string,
	content: string | null,
) {
	await assertSubmissionMutationAllowed(taskId, userId);

	const submissionId = await ensureSubmission(taskId, userId);

	await prisma.submission.update({
		where: { id: submissionId },
		data: {
			content,
		},
	});

	await markTaskSubmissionTouched(taskId, userId);

	return getSubmissionDetailOrThrow(submissionId);
}

export async function upsertMySubmissionAttachments(
	taskId: string,
	userId: string,
	attachmentRecords: Array<{
		fileKey: string;
		originalName: string;
		mimeType: string | null;
		sizeBytes: bigint;
	}>,
) {
	await assertSubmissionMutationAllowed(taskId, userId);

	const existingSubmission = await prisma.submission.findUnique({
		where: {
			taskId_userId: {
				taskId,
				userId,
			},
		},
		select: {
			id: true,
		},
	});

	const submissionId =
		existingSubmission?.id ?? (await ensureSubmission(taskId, userId));

	if (existingSubmission) {
		await removeSubmissionAttachments(submissionId);
	}

	if (attachmentRecords.length > 0) {
		await prisma.attachment.createMany({
			data: attachmentRecords.map((a) => ({
				fileKey: a.fileKey,
				originalName: a.originalName,
				mimeType: a.mimeType,
				sizeBytes: a.sizeBytes,
				uploadedBy: userId,
				submissionId,
			})),
		});
	}

	await prisma.submission.update({
		where: { id: submissionId },
		data: {
			lastUpdatedAt: new Date(),
		},
	});

	await markTaskSubmissionTouched(taskId, userId);

	return getSubmissionDetailOrThrow(submissionId);
}

export async function addSubmissionAttachments(
	taskId: string,
	userId: string,
	attachmentRecords: Array<{
		fileKey: string;
		originalName: string;
		mimeType: string | null;
		sizeBytes: bigint;
	}>,
) {
	await assertSubmissionMutationAllowed(taskId, userId);

	const submissionId = await ensureSubmission(taskId, userId);

	if (attachmentRecords.length > 0) {
		await prisma.attachment.createMany({
			data: attachmentRecords.map((a) => ({
				fileKey: a.fileKey,
				originalName: a.originalName,
				mimeType: a.mimeType,
				sizeBytes: a.sizeBytes,
				uploadedBy: userId,
				submissionId,
			})),
		});
	}

	await prisma.submission.update({
		where: { id: submissionId },
		data: { lastUpdatedAt: new Date() },
	});

	await markTaskSubmissionTouched(taskId, userId);

	const created = await prisma.attachment.findMany({
		where: { fileKey: { in: attachmentRecords.map((a) => a.fileKey) } },
		orderBy: { createdAt: "asc" },
	});

	return created.map(toAttachmentMeta);
}

export async function assertCanUploadSubmissionAttachments(
	taskId: string,
	userId: string,
) {
	await assertSubmissionMutationAllowed(taskId, userId);
}

export async function assertCanUploadTaskAttachments(
	taskId: string,
	userId: string,
) {
	const { classMembership } = await assertTaskAccess(taskId, userId);

	if (!classMembership) {
		throw new AppError(
			403,
			"FORBIDDEN",
			"Only class admin can upload task attachments",
		);
	}

	requireOwnerOrAdmin(classMembership);
}

export async function addTaskAttachments(
	taskId: string,
	userId: string,
	attachmentRecords: Array<{
		fileKey: string;
		originalName: string;
		mimeType: string | null;
		sizeBytes: bigint;
	}>,
	isVisible = true,
) {
	const { classMembership } = await assertTaskAccess(taskId, userId);

	if (!classMembership) {
		throw new AppError(
			403,
			"FORBIDDEN",
			"Only class admin can upload task attachments",
		);
	}

	requireOwnerOrAdmin(classMembership);

	if (attachmentRecords.length > 0) {
		await prisma.attachment.createMany({
			data: attachmentRecords.map((a) => ({
				fileKey: a.fileKey,
				originalName: a.originalName,
				mimeType: a.mimeType,
				sizeBytes: a.sizeBytes,
				isVisible,
				uploadedBy: userId,
				taskId,
			})),
		});
	}

	const created = await prisma.attachment.findMany({
		where: { fileKey: { in: attachmentRecords.map((a) => a.fileKey) } },
		orderBy: { createdAt: "asc" },
	});

	return created.map(toAttachmentMeta);
}

export async function gradeSubmission(
	taskId: string,
	submissionId: string,
	userId: string,
	input: {
		score?: string | null;
		reviewNote?: string | null;
	},
) {
	const { classMembership } = await assertTaskAccess(taskId, userId);

	if (!classMembership) {
		throw new AppError(
			403,
			"FORBIDDEN",
			"Only class admin can grade submissions",
		);
	}

	requireOwnerOrAdmin(classMembership);

	const submission = await prisma.submission.findUnique({
		where: { id: submissionId },
	});

	if (!submission || submission.taskId !== taskId) {
		throw new AppError(404, "SUBMISSION_NOT_FOUND", "Submission not found");
	}

	const updated = await prisma.submission.update({
		where: { id: submissionId },
		data: {
			score: input.score ? input.score : null,
			reviewNote: input.reviewNote ?? null,
			reviewerId: userId,
			reviewedAt: new Date(),
		},
		include: {
			attachments: true,
		},
	});

	return {
		...toSubmission(updated),
		attachments: updated.attachments.map(toAttachmentMeta),
	};
}

export async function exportTaskSubmissionsCsv(taskId: string, userId: string) {
	const { task, classMembership } = await assertTaskAccess(taskId, userId);

	if (!classMembership || !task.classId) {
		throw new AppError(403, "FORBIDDEN", "Only class admin can export csv");
	}

	requireOwnerOrAdmin(classMembership);

	const members = await prisma.classMember.findMany({
		where: { classId: task.classId },
		include: {
			user: {
				include: {
					school: {
						select: { name: true },
					},
				},
			},
			class: {
				select: {
					name: true,
				},
			},
		},
	});

	const submissions = await prisma.submission.findMany({ where: { taskId } });
	const submissionMap = new Map(
		submissions.map((submission) => [submission.userId, submission]),
	);

	const rows = [
		[
			"昵称",
			"学校",
			"学号",
			"班级",
			"任务名称",
			"首次提交时间",
			"最后修改时间",
			"成绩",
		],
		...members.map((member) => {
			const submission = submissionMap.get(member.userId);

			return [
				member.user.nickname ?? member.user.studentId ?? "Unknown",
				member.user.school?.name ?? "",
				member.user.studentId ?? "",
				member.class.name,
				task.title,
				submission?.firstSubmittedAt.toISOString() ?? "",
				submission?.lastUpdatedAt.toISOString() ?? "",
				submission?.score ? String(submission.score) : "",
			];
		}),
	];

	return rows
		.map((row) =>
			row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","),
		)
		.join("\n");
}

export async function toggleExemplary(
	taskId: string,
	submissionId: string,
	userId: string,
) {
	const { classMembership } = await assertTaskAccess(taskId, userId);

	if (!classMembership) {
		throw new AppError(
			403,
			"FORBIDDEN",
			"Only class admin can toggle exemplary status",
		);
	}

	requireOwnerOrAdmin(classMembership);

	const submission = await prisma.submission.findUnique({
		where: { id: submissionId },
		include: { attachments: true },
	});

	if (!submission || submission.taskId !== taskId) {
		throw new AppError(404, "SUBMISSION_NOT_FOUND", "Submission not found");
	}

	const newValue = !submission.isExemplary;

	// Marking as exemplary requires score and reviewNote >= 30 chars
	if (newValue) {
		if (submission.score === null || submission.score === undefined) {
			throw new AppError(
				400,
				"EXEMPLARY_REQUIRES_SCORE",
				"Submission must be graded before marking as exemplary",
			);
		}

		if (!submission.reviewNote || submission.reviewNote.length < 30) {
			throw new AppError(
				400,
				"EXEMPLARY_REQUIRES_REVIEW_NOTE",
				"Review note must be at least 30 characters",
			);
		}
	}

	const updated = await prisma.submission.update({
		where: { id: submissionId },
		data: { isExemplary: newValue },
		include: { attachments: true },
	});

	return {
		...toSubmission(updated),
		attachments: updated.attachments.map(toAttachmentMeta),
	};
}

export async function renameTaskSubmissionAttachments(
	taskId: string,
	userId: string,
) {
	const { task, classMembership } = await assertTaskAccess(taskId, userId);

	if (!classMembership || !task.classId) {
		throw new AppError(
			403,
			"FORBIDDEN",
			"Only class admin can rename attachments",
		);
	}

	requireOwnerOrAdmin(classMembership);

	const submissions = await prisma.submission.findMany({
		where: { taskId },
		include: {
			user: true,
			attachments: true,
			task: {
				include: {
					class: true,
				},
			},
		},
	});

	for (const submission of submissions) {
		for (const attachment of submission.attachments) {
			const displayName = [
				submission.task.class?.name ?? "UnknownClass",
				submission.user.nickname ?? submission.user.studentId ?? "Unknown",
				submission.user.studentId ?? "",
				attachment.originalName,
			]
				.filter((part) => part)
				.join("_");

			await prisma.attachment.update({
				where: { id: attachment.id },
				data: {
					renamedFile: displayName,
				},
			});
		}
	}
}
