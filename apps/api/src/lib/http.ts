import { createHash } from "node:crypto";
import type { ClassRole, McpKey, User } from "@taskflow/db";

export function emailToAvatarHash(email: string): string {
	return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export function toUserProfile(
	user: User & { school: { name: string } | null },
	avatarFileKey?: string | null,
) {
	return {
		id: user.id,
		email: user.email,
		nickname: user.nickname,
		schoolId: user.schoolId,
		schoolName: user.school?.name ?? null,
		studentId: user.studentId,
		timezone: user.timezone,
		isActive: user.isActive,
		avatarFileKey: avatarFileKey ?? null,
		createdAt: user.createdAt.toISOString(),
	};
}

interface ClassSummarySource {
	id: string;
	name: string;
	description: string | null;
	color: string;
	isPersonal: boolean;
	ownerId: string;
	schoolId: string | null;
	inviteCode: string | null;
	createdAt: Date;
	_count: {
		members: number;
	};
}

export function toClassSummary(
	classInfo: ClassSummarySource,
	myRole: ClassRole,
) {
	return {
		id: classInfo.id,
		name: classInfo.name,
		description: classInfo.description,
		color: classInfo.color,
		isPersonal: classInfo.isPersonal,
		ownerId: classInfo.ownerId,
		schoolId: classInfo.schoolId,
		inviteCode: myRole === "MEMBER" ? null : classInfo.inviteCode,
		myRole,
		memberCount: classInfo._count.members,
		createdAt: classInfo.createdAt.toISOString(),
	};
}

interface ClassMemberSource {
	userId: string;
	role: ClassRole;
	joinedAt: Date;
	user: {
		email: string;
		nickname: string | null;
	};
}

export function toClassMember(member: ClassMemberSource) {
	return {
		userId: member.userId,
		nickname: member.user.nickname,
		avatarHash: emailToAvatarHash(member.user.email),
		role: member.role,
		joinedAt: member.joinedAt.toISOString(),
	};
}

interface TaskUserStateSource {
	viewedAt: Date | null;
	tags: string[];
	sortOrder: number;
}

interface TaskSummarySource {
	id: string;
	classId: string | null;
	title: string;
	sourceText: string | null;
	startAt: Date | null;
	dueAt: Date | null;
	allowLateSubmission: boolean;
	blockedBy: string[];
	isPublished: boolean;
	publishedAt: Date | null;
	createdBy: string | null;
	createdAt: Date;
	updatedAt: Date;
	class: { name: string } | null;
}

export function toTaskUserState(
	state: TaskUserStateSource | null,
	submittedAt?: Date | null,
) {
	if (!state && !submittedAt) {
		return null;
	}

	return {
		viewedAt: state?.viewedAt?.toISOString() ?? null,
		tags: state?.tags ?? [],
		sortOrder: state?.sortOrder ?? 0,
		submittedAt: submittedAt?.toISOString() ?? null,
	};
}

export function toTaskSummary(
	task: TaskSummarySource,
	state: TaskUserStateSource | null,
	submittedAt?: Date | null,
) {
	return {
		id: task.id,
		classId: task.classId,
		className: task.class?.name ?? null,
		title: task.title,
		sourceText: task.sourceText,
		startAt: task.startAt?.toISOString() ?? null,
		dueAt: task.dueAt?.toISOString() ?? null,
		allowLateSubmission: task.allowLateSubmission,
		blockedBy: task.blockedBy,
		isPublished: task.isPublished,
		publishedAt: task.publishedAt?.toISOString() ?? null,
		createdBy: task.createdBy,
		createdAt: task.createdAt.toISOString(),
		updatedAt: task.updatedAt.toISOString(),
		userState: toTaskUserState(state, submittedAt),
	};
}

interface AttachmentSource {
	id: string;
	fileKey: string;
	originalName: string;
	renamedFile: string | null;
	mimeType: string | null;
	sizeBytes: bigint | null;
	createdAt: Date;
}

export function toAttachmentMeta(attachment: AttachmentSource) {
	return {
		id: attachment.id,
		fileKey: attachment.fileKey,
		originalName: attachment.originalName,
		renamedFile: attachment.renamedFile,
		mimeType: attachment.mimeType,
		sizeBytes: attachment.sizeBytes ? Number(attachment.sizeBytes) : null,
		createdAt: attachment.createdAt.toISOString(),
	};
}

export function toMcpKey(key: McpKey) {
	return {
		id: key.id,
		name: key.name,
		keyPrefix: key.keyPrefix,
		lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
		expiresAt: key.expiresAt?.toISOString() ?? null,
		createdAt: key.createdAt.toISOString(),
		revokedAt: key.revokedAt?.toISOString() ?? null,
	};
}

interface CommentSource {
	id: string;
	content: string;
	createdAt: Date;
	author: {
		id: string;
		nickname: string | null;
		email: string;
	} | null;
	replyTo: {
		id: string;
		nickname: string | null;
	} | null;
}

export function toComment(comment: CommentSource) {
	return {
		id: comment.id,
		content: comment.content,
		createdAt: comment.createdAt.toISOString(),
		author: comment.author
			? {
					id: comment.author.id,
					nickname: comment.author.nickname,
					avatarHash: emailToAvatarHash(comment.author.email),
				}
			: null,
		replyTo: comment.replyTo
			? {
					id: comment.replyTo.id,
					nickname: comment.replyTo.nickname,
				}
			: null,
	};
}

interface SubmissionSource {
	id: string;
	taskId: string;
	userId: string;
	firstSubmittedAt: Date;
	lastUpdatedAt: Date;
	content: string | null;
	score: unknown;
	reviewerId: string | null;
	reviewedAt: Date | null;
	reviewNote: string | null;
	isExemplary: boolean;
}

export function toSubmission(submission: SubmissionSource) {
	return {
		id: submission.id,
		taskId: submission.taskId,
		userId: submission.userId,
		firstSubmittedAt: submission.firstSubmittedAt.toISOString(),
		lastUpdatedAt: submission.lastUpdatedAt.toISOString(),
		content: submission.content,
		score:
			submission.score !== null && submission.score !== undefined
				? String(submission.score)
				: null,
		reviewerId: submission.reviewerId,
		reviewedAt: submission.reviewedAt?.toISOString() ?? null,
		reviewNote: submission.reviewNote,
		isExemplary: submission.isExemplary,
	};
}
