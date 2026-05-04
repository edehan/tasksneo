import { randomBytes } from "node:crypto";
import { ClassRole, prisma } from "@taskflow/db";

import {
	cacheDel,
	cacheDelPattern,
	cacheGetOrSet,
	cacheKeys,
} from "../lib/cache.js";
import { AppError } from "../lib/errors.js";
import { toClassMember, toClassSummary } from "../lib/http.js";
import { removeObject } from "../lib/storage.js";
import {
	getMembershipOrThrow,
	requireOwner,
	requireOwnerOrAdmin,
} from "./policy.service.js";
import { hardDeleteTask, softDeleteTask } from "./task-cleanup.service.js";

const DEFAULT_CLASS_COLOR = "#6366f1";
const INVITE_CODE_LENGTH = 10;
const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const USER_CLASSES_TTL_SECONDS = 60;

export interface CreateClassInput {
	name: string;
	description?: string | null;
	color?: string;
	schoolId?: string | null;
}

export type JoinClassPreviewStatus =
	| "JOINABLE"
	| "ALREADY_MEMBER"
	| "SCHOOL_MISMATCH";

export interface JoinClassPreview {
	id: string;
	name: string;
	description: string | null;
	color: string;
	schoolId: string | null;
	schoolName: string | null;
	inviteCode: string;
	memberCount: number;
	status: JoinClassPreviewStatus;
	myRole: ClassRole | null;
}

function generateInviteCode(length: number): string {
	const bytes = randomBytes(length);
	let result = "";

	for (let i = 0; i < length; i += 1) {
		const index = bytes[i] % INVITE_CODE_ALPHABET.length;
		result += INVITE_CODE_ALPHABET[index];
	}

	return result;
}

async function createUniqueInviteCode(): Promise<string> {
	for (let attempt = 0; attempt < 8; attempt += 1) {
		const inviteCode = generateInviteCode(INVITE_CODE_LENGTH);
		const existing = await prisma.class.findUnique({ where: { inviteCode } });

		if (!existing) {
			return inviteCode;
		}
	}

	throw new AppError(
		500,
		"INVITE_CODE_GENERATION_FAILED",
		"Failed to generate invite code",
	);
}

async function getClassById(classId: string) {
	return prisma.class.findUnique({
		where: { id: classId },
		include: {
			_count: {
				select: {
					members: true,
				},
			},
		},
	});
}

async function invalidateUserClassLists(userIds: string[]) {
	const uniqueIds = [...new Set(userIds)];
	await cacheDel(...uniqueIds.map((userId) => cacheKeys.userClasses(userId)));
}

async function invalidateClassMemberClassLists(classId: string) {
	const members = await prisma.classMember.findMany({
		where: { classId },
		select: { userId: true },
	});
	await invalidateUserClassLists(members.map((member) => member.userId));
}

export async function listMyClasses(userId: string) {
	return cacheGetOrSet(
		cacheKeys.userClasses(userId),
		USER_CLASSES_TTL_SECONDS,
		async () => {
			const memberships = await prisma.classMember.findMany({
				where: { userId },
				include: {
					class: {
						include: {
							_count: {
								select: {
									members: true,
								},
							},
						},
					},
				},
				orderBy: {
					joinedAt: "asc",
				},
			});

			return memberships.map((membership) =>
				toClassSummary(membership.class, membership.role),
			);
		},
	);
}

export async function createClass(userId: string, input: CreateClassInput) {
	const inviteCode = await createUniqueInviteCode();

	if (input.schoolId) {
		const school = await prisma.school.findUnique({
			where: { id: input.schoolId },
		});

		if (!school) {
			throw new AppError(400, "SCHOOL_NOT_FOUND", "School does not exist");
		}
	}

	const classInfo = await prisma.$transaction(async (tx) => {
		const createdClass = await tx.class.create({
			data: {
				name: input.name,
				description: input.description ?? null,
				color: input.color ?? DEFAULT_CLASS_COLOR,
				schoolId: input.schoolId ?? null,
				ownerId: userId,
				inviteCode,
			},
		});

		await tx.classMember.create({
			data: {
				classId: createdClass.id,
				userId,
				role: ClassRole.OWNER,
			},
		});

		return tx.class.findUnique({
			where: { id: createdClass.id },
			include: {
				_count: {
					select: {
						members: true,
					},
				},
			},
		});
	});

	if (!classInfo) {
		throw new AppError(500, "CLASS_CREATE_FAILED", "Failed to create class");
	}

	await invalidateUserClassLists([userId]);

	return toClassSummary(classInfo, ClassRole.OWNER);
}

export async function joinClass(userId: string, inviteCode: string) {
	const targetClass = await prisma.class.findUnique({
		where: { inviteCode },
		include: {
			school: {
				select: {
					name: true,
				},
			},
			_count: {
				select: {
					members: true,
				},
			},
		},
	});

	if (!targetClass) {
		throw new AppError(404, "INVITE_CODE_NOT_FOUND", "Invite code not found");
	}

	if (targetClass.isPersonal) {
		throw new AppError(403, "FORBIDDEN", "Cannot join personal class");
	}

	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			schoolId: true,
		},
	});

	if (!user) {
		throw new AppError(401, "UNAUTHORIZED", "User not found");
	}

	const existingMembership = await prisma.classMember.findUnique({
		where: {
			classId_userId: {
				classId: targetClass.id,
				userId,
			},
		},
	});

	if (existingMembership) {
		throw new AppError(409, "ALREADY_MEMBER", "You are already a class member");
	}

	if (targetClass.schoolId && user.schoolId !== targetClass.schoolId) {
		throw new AppError(
			403,
			"SCHOOL_MISMATCH",
			"Your school does not match class restriction",
		);
	}

	await prisma.classMember.create({
		data: {
			classId: targetClass.id,
			userId,
			role: ClassRole.MEMBER,
		},
	});
	await cacheDel(
		cacheKeys.membership(targetClass.id, userId),
		cacheKeys.classDetail(targetClass.id),
		cacheKeys.userClasses(userId),
	);

	const joinedClass = await getClassById(targetClass.id);

	if (!joinedClass) {
		throw new AppError(404, "CLASS_NOT_FOUND", "Class not found");
	}

	return toClassSummary(joinedClass, ClassRole.MEMBER);
}

export async function getJoinClassPreview(
	userId: string,
	inviteCode: string,
): Promise<JoinClassPreview> {
	const targetClass = await prisma.class.findUnique({
		where: { inviteCode },
		include: {
			school: {
				select: {
					name: true,
				},
			},
			_count: {
				select: {
					members: true,
				},
			},
		},
	});

	if (!targetClass) {
		throw new AppError(404, "INVITE_CODE_NOT_FOUND", "Invite code not found");
	}

	if (targetClass.isPersonal) {
		throw new AppError(403, "FORBIDDEN", "Cannot join personal class");
	}

	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			schoolId: true,
		},
	});

	if (!user) {
		throw new AppError(401, "UNAUTHORIZED", "User not found");
	}

	const existingMembership = await prisma.classMember.findUnique({
		where: {
			classId_userId: {
				classId: targetClass.id,
				userId,
			},
		},
		select: {
			role: true,
		},
	});

	let status: JoinClassPreviewStatus = "JOINABLE";

	if (existingMembership) {
		status = "ALREADY_MEMBER";
	} else if (targetClass.schoolId && user.schoolId !== targetClass.schoolId) {
		status = "SCHOOL_MISMATCH";
	}

	return {
		id: targetClass.id,
		name: targetClass.name,
		description: targetClass.description,
		color: targetClass.color,
		schoolId: targetClass.schoolId,
		schoolName: targetClass.school?.name ?? null,
		inviteCode: targetClass.inviteCode ?? inviteCode,
		memberCount: targetClass._count.members,
		status,
		myRole: existingMembership?.role ?? null,
	};
}

const CLASS_DETAIL_TTL_SECONDS = 300;

interface ClassDetailCacheEntry {
	id: string;
	name: string;
	description: string | null;
	color: string;
	schoolId: string | null;
	ownerId: string;
	inviteCode: string | null;
	isPersonal: boolean;
	createdAt: string;
	_count: { members: number };
}

export async function getClassDetail(classId: string, userId: string) {
	const membership = await getMembershipOrThrow(classId, userId);
	const cached = await cacheGetOrSet<ClassDetailCacheEntry | null>(
		cacheKeys.classDetail(classId),
		CLASS_DETAIL_TTL_SECONDS,
		async () => {
			const row = await getClassById(classId);
			if (!row) return null;
			return {
				id: row.id,
				name: row.name,
				description: row.description,
				color: row.color,
				schoolId: row.schoolId,
				ownerId: row.ownerId,
				inviteCode: row.inviteCode,
				isPersonal: row.isPersonal,
				createdAt: row.createdAt.toISOString(),
				_count: row._count,
			};
		},
	);

	if (!cached) {
		throw new AppError(404, "CLASS_NOT_FOUND", "Class not found");
	}

	// toClassSummary accepts Date | string for createdAt via the http helper.
	return toClassSummary(
		{
			...cached,
			createdAt: new Date(cached.createdAt),
		},
		membership.role,
	);
}

export async function updateClass(
	classId: string,
	userId: string,
	input: {
		name?: string;
		description?: string | null;
		color?: string;
		schoolId?: string | null;
	},
) {
	const membership = await getMembershipOrThrow(classId, userId);
	requireOwnerOrAdmin(membership);

	if (input.schoolId) {
		const school = await prisma.school.findUnique({
			where: { id: input.schoolId },
		});

		if (!school) {
			throw new AppError(400, "SCHOOL_NOT_FOUND", "School does not exist");
		}
	}

	const updatedClass = await prisma.class.update({
		where: { id: classId },
		data: {
			name: input.name,
			description: input.description,
			color: input.color,
			schoolId: input.schoolId,
		},
		include: {
			_count: {
				select: {
					members: true,
				},
			},
		},
	});
	await cacheDel(cacheKeys.classDetail(classId));
	await invalidateClassMemberClassLists(classId);

	return toClassSummary(updatedClass, membership.role);
}

export async function refreshInviteCode(classId: string, userId: string) {
	const membership = await getMembershipOrThrow(classId, userId);
	requireOwnerOrAdmin(membership);

	if (membership.isPersonal) {
		throw new AppError(
			403,
			"FORBIDDEN",
			"Cannot refresh invite code for personal class",
		);
	}

	const inviteCode = await createUniqueInviteCode();

	const updatedClass = await prisma.class.update({
		where: { id: classId },
		data: { inviteCode },
	});
	await cacheDel(cacheKeys.classDetail(classId));
	await invalidateClassMemberClassLists(classId);

	return {
		inviteCode: updatedClass.inviteCode,
	};
}

export async function transferOwnership(
	classId: string,
	userId: string,
	newOwnerId: string,
) {
	const membership = await getMembershipOrThrow(classId, userId);
	requireOwner(membership);

	const targetMembership = await prisma.classMember.findUnique({
		where: {
			classId_userId: {
				classId,
				userId: newOwnerId,
			},
		},
	});

	if (!targetMembership) {
		throw new AppError(
			400,
			"TARGET_NOT_MEMBER",
			"Target user is not class member",
		);
	}

	await prisma.$transaction(async (tx) => {
		await tx.class.update({
			where: { id: classId },
			data: { ownerId: newOwnerId },
		});

		await tx.classMember.update({
			where: {
				classId_userId: {
					classId,
					userId: newOwnerId,
				},
			},
			data: {
				role: ClassRole.OWNER,
			},
		});

		await tx.classMember.update({
			where: {
				classId_userId: {
					classId,
					userId,
				},
			},
			data: {
				role: ClassRole.ADMIN,
			},
		});
	});
	// Owner change affects ownerId in every cached membership for this class.
	await cacheDelPattern(cacheKeys.membershipClassPattern(classId));
	await cacheDel(cacheKeys.classDetail(classId));
	await invalidateClassMemberClassLists(classId);

	const updatedClass = await getClassById(classId);

	if (!updatedClass) {
		throw new AppError(404, "CLASS_NOT_FOUND", "Class not found");
	}

	return toClassSummary(updatedClass, ClassRole.ADMIN);
}

export async function listClassMembers(classId: string, userId: string) {
	await getMembershipOrThrow(classId, userId);

	const members = await prisma.classMember.findMany({
		where: { classId },
		include: {
			user: {
				select: {
					email: true,
					nickname: true,
				},
			},
		},
		orderBy: {
			joinedAt: "asc",
		},
	});

	return members.map((member) => toClassMember(member));
}

export async function updateMemberRole(
	classId: string,
	currentUserId: string,
	targetUserId: string,
	role: "ADMIN" | "MEMBER",
) {
	const membership = await getMembershipOrThrow(classId, currentUserId);
	requireOwner(membership);

	if (targetUserId === currentUserId) {
		throw new AppError(400, "INVALID_TARGET", "Cannot update your own role");
	}

	const targetMembership = await prisma.classMember.findUnique({
		where: {
			classId_userId: {
				classId,
				userId: targetUserId,
			},
		},
		include: {
			user: {
				select: {
					email: true,
					nickname: true,
				},
			},
		},
	});

	if (!targetMembership) {
		throw new AppError(404, "MEMBER_NOT_FOUND", "Class member not found");
	}

	if (targetMembership.role === ClassRole.OWNER) {
		throw new AppError(403, "FORBIDDEN", "Cannot change owner role directly");
	}

	const updatedMembership = await prisma.classMember.update({
		where: {
			classId_userId: {
				classId,
				userId: targetUserId,
			},
		},
		data: {
			role,
		},
		include: {
			user: {
				select: {
					email: true,
					nickname: true,
				},
			},
		},
	});
	await cacheDel(cacheKeys.membership(classId, targetUserId));
	await invalidateUserClassLists([targetUserId]);

	return toClassMember(updatedMembership);
}

export async function removeMember(
	classId: string,
	currentUserId: string,
	targetUserId: string,
) {
	const membership = await getMembershipOrThrow(classId, currentUserId);
	const targetMembership = await prisma.classMember.findUnique({
		where: {
			classId_userId: {
				classId,
				userId: targetUserId,
			},
		},
	});

	if (!targetMembership) {
		throw new AppError(404, "MEMBER_NOT_FOUND", "Class member not found");
	}

	if (targetMembership.role === ClassRole.OWNER) {
		throw new AppError(403, "FORBIDDEN", "Cannot remove owner");
	}

	const isSelfLeave = currentUserId === targetUserId;

	if (isSelfLeave) {
		if (membership.role === ClassRole.OWNER) {
			throw new AppError(
				403,
				"FORBIDDEN",
				"Owner must transfer ownership before leaving",
			);
		}
	} else {
		if (membership.role === ClassRole.MEMBER) {
			throw new AppError(403, "FORBIDDEN", "Insufficient permission");
		}

		if (
			membership.role === ClassRole.ADMIN &&
			targetMembership.role !== ClassRole.MEMBER
		) {
			throw new AppError(403, "FORBIDDEN", "Admin can only remove members");
		}
	}

	await prisma.classMember.delete({
		where: {
			classId_userId: {
				classId,
				userId: targetUserId,
			},
		},
	});
	await cacheDel(
		cacheKeys.membership(classId, targetUserId),
		cacheKeys.classDetail(classId),
		cacheKeys.userClasses(targetUserId),
	);
}

export async function deleteClass(classId: string, userId: string) {
	const membership = await getMembershipOrThrow(classId, userId);
	requireOwner(membership);

	const classInfo = await prisma.class.findUnique({ where: { id: classId } });

	if (!classInfo) {
		throw new AppError(404, "CLASS_NOT_FOUND", "Class not found");
	}

	if (classInfo.isPersonal) {
		throw new AppError(403, "FORBIDDEN", "Personal class cannot be deleted");
	}

	const tasks = await prisma.task.findMany({
		where: { classId },
		select: {
			id: true,
			_count: {
				select: {
					submissions: true,
				},
			},
		},
	});
	const members = await prisma.classMember.findMany({
		where: { classId },
		select: { userId: true },
	});

	for (const task of tasks) {
		if (task._count.submissions > 0) {
			await softDeleteTask(task.id, true);
		} else {
			await hardDeleteTask(task.id);
		}
	}

	const classAttachments = await prisma.attachment.findMany({
		where: { classId },
		select: { fileKey: true },
	});

	for (const attachment of classAttachments) {
		await removeObject(attachment.fileKey);
	}

	await prisma.attachment.deleteMany({ where: { classId } });

	await prisma.class.delete({ where: { id: classId } });
	await cacheDelPattern(cacheKeys.membershipClassPattern(classId));
	await cacheDel(
		cacheKeys.classDetail(classId),
		...members.map((member) => cacheKeys.userClasses(member.userId)),
	);
}
