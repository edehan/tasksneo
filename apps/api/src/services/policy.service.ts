import { ClassRole, prisma } from "@taskflow/db";

import { AppError } from "../lib/errors.js";

export interface MembershipContext {
	classId: string;
	userId: string;
	role: ClassRole;
	isPersonal: boolean;
	ownerId: string;
}

export async function getMembershipOrThrow(
	classId: string,
	userId: string,
): Promise<MembershipContext> {
	const membership = await prisma.classMember.findUnique({
		where: {
			classId_userId: {
				classId,
				userId,
			},
		},
		include: {
			class: {
				select: {
					id: true,
					isPersonal: true,
					ownerId: true,
				},
			},
		},
	});

	if (!membership) {
		const existingClass = await prisma.class.findUnique({
			where: { id: classId },
			select: { id: true },
		});

		if (!existingClass) {
			throw new AppError(404, "CLASS_NOT_FOUND", "Class not found");
		}

		throw new AppError(403, "FORBIDDEN", "You are not a member of this class");
	}

	return {
		classId: membership.class.id,
		userId,
		role: membership.role,
		isPersonal: membership.class.isPersonal,
		ownerId: membership.class.ownerId,
	};
}

export function requireOwnerOrAdmin(membership: MembershipContext) {
	if (
		membership.role !== ClassRole.OWNER &&
		membership.role !== ClassRole.ADMIN
	) {
		throw new AppError(403, "FORBIDDEN", "Owner or admin permission required");
	}
}

export function requireOwner(membership: MembershipContext) {
	if (membership.role !== ClassRole.OWNER) {
		throw new AppError(403, "FORBIDDEN", "Owner permission required");
	}
}
