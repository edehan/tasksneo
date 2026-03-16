import { ClassRole, prisma } from '@taskflow/db';
import { randomBytes } from 'node:crypto';

import { AppError } from '../lib/errors.js';
import { toClassMember, toClassSummary } from '../lib/http.js';
import { removeObject } from '../lib/storage.js';
import { getMembershipOrThrow, requireOwner, requireOwnerOrAdmin } from './policy.service.js';
import { hardDeleteTask, softDeleteTask } from './task-cleanup.service.js';

const DEFAULT_CLASS_COLOR = '#6366f1';
const INVITE_CODE_LENGTH = 10;
const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface CreateClassInput {
  name: string;
  description?: string | null;
  color?: string;
  schoolId?: string | null;
}

function generateInviteCode(length: number): string {
  const bytes = randomBytes(length);
  let result = '';

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

  throw new AppError(500, 'INVITE_CODE_GENERATION_FAILED', 'Failed to generate invite code');
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

export async function listMyClasses(userId: string) {
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
      joinedAt: 'asc',
    },
  });

  return memberships.map((membership) => toClassSummary(membership.class, membership.role));
}

export async function createClass(userId: string, input: CreateClassInput) {
  const inviteCode = await createUniqueInviteCode();

  if (input.schoolId) {
    const school = await prisma.school.findUnique({ where: { id: input.schoolId } });

    if (!school) {
      throw new AppError(400, 'SCHOOL_NOT_FOUND', 'School does not exist');
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
    throw new AppError(500, 'CLASS_CREATE_FAILED', 'Failed to create class');
  }

  return toClassSummary(classInfo, ClassRole.OWNER);
}

export async function joinClass(userId: string, inviteCode: string) {
  const targetClass = await prisma.class.findUnique({
    where: { inviteCode },
    include: {
      _count: {
        select: {
          members: true,
        },
      },
    },
  });

  if (!targetClass) {
    throw new AppError(404, 'INVITE_CODE_NOT_FOUND', 'Invite code not found');
  }

  if (targetClass.isPersonal) {
    throw new AppError(403, 'FORBIDDEN', 'Cannot join personal class');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      schoolId: true,
    },
  });

  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'User not found');
  }

  if (targetClass.schoolId && user.schoolId !== targetClass.schoolId) {
    throw new AppError(403, 'SCHOOL_MISMATCH', 'Your school does not match class restriction');
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
    throw new AppError(409, 'ALREADY_MEMBER', 'You are already a class member');
  }

  await prisma.classMember.create({
    data: {
      classId: targetClass.id,
      userId,
      role: ClassRole.MEMBER,
    },
  });

  const joinedClass = await getClassById(targetClass.id);

  if (!joinedClass) {
    throw new AppError(404, 'CLASS_NOT_FOUND', 'Class not found');
  }

  return toClassSummary(joinedClass, ClassRole.MEMBER);
}

export async function getClassDetail(classId: string, userId: string) {
  const membership = await getMembershipOrThrow(classId, userId);
  const classInfo = await getClassById(classId);

  if (!classInfo) {
    throw new AppError(404, 'CLASS_NOT_FOUND', 'Class not found');
  }

  return toClassSummary(classInfo, membership.role);
}

export async function updateClass(classId: string, userId: string, input: { name?: string; description?: string | null; color?: string }) {
  const membership = await getMembershipOrThrow(classId, userId);
  requireOwnerOrAdmin(membership);

  const updatedClass = await prisma.class.update({
    where: { id: classId },
    data: {
      name: input.name,
      description: input.description,
      color: input.color,
    },
    include: {
      _count: {
        select: {
          members: true,
        },
      },
    },
  });

  return toClassSummary(updatedClass, membership.role);
}

export async function refreshInviteCode(classId: string, userId: string) {
  const membership = await getMembershipOrThrow(classId, userId);
  requireOwnerOrAdmin(membership);

  if (membership.isPersonal) {
    throw new AppError(403, 'FORBIDDEN', 'Cannot refresh invite code for personal class');
  }

  const inviteCode = await createUniqueInviteCode();

  const updatedClass = await prisma.class.update({
    where: { id: classId },
    data: { inviteCode },
  });

  return {
    inviteCode: updatedClass.inviteCode,
  };
}

export async function transferOwnership(classId: string, userId: string, newOwnerId: string) {
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
    throw new AppError(400, 'TARGET_NOT_MEMBER', 'Target user is not class member');
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

  const updatedClass = await getClassById(classId);

  if (!updatedClass) {
    throw new AppError(404, 'CLASS_NOT_FOUND', 'Class not found');
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
      joinedAt: 'asc',
    },
  });

  return members.map((member) => toClassMember(member));
}

export async function updateMemberRole(classId: string, currentUserId: string, targetUserId: string, role: 'ADMIN' | 'MEMBER') {
  const membership = await getMembershipOrThrow(classId, currentUserId);
  requireOwner(membership);

  if (targetUserId === currentUserId) {
    throw new AppError(400, 'INVALID_TARGET', 'Cannot update your own role');
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
    throw new AppError(404, 'MEMBER_NOT_FOUND', 'Class member not found');
  }

  if (targetMembership.role === ClassRole.OWNER) {
    throw new AppError(403, 'FORBIDDEN', 'Cannot change owner role directly');
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

  return toClassMember(updatedMembership);
}

export async function removeMember(classId: string, currentUserId: string, targetUserId: string) {
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
    throw new AppError(404, 'MEMBER_NOT_FOUND', 'Class member not found');
  }

  if (targetMembership.role === ClassRole.OWNER) {
    throw new AppError(403, 'FORBIDDEN', 'Cannot remove owner');
  }

  const isSelfLeave = currentUserId === targetUserId;

  if (isSelfLeave) {
    if (membership.role === ClassRole.OWNER) {
      throw new AppError(403, 'FORBIDDEN', 'Owner must transfer ownership before leaving');
    }
  } else {
    if (membership.role === ClassRole.MEMBER) {
      throw new AppError(403, 'FORBIDDEN', 'Insufficient permission');
    }

    if (membership.role === ClassRole.ADMIN && targetMembership.role !== ClassRole.MEMBER) {
      throw new AppError(403, 'FORBIDDEN', 'Admin can only remove members');
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
}

export async function deleteClass(classId: string, userId: string) {
  const membership = await getMembershipOrThrow(classId, userId);
  requireOwner(membership);

  const classInfo = await prisma.class.findUnique({ where: { id: classId } });

  if (!classInfo) {
    throw new AppError(404, 'CLASS_NOT_FOUND', 'Class not found');
  }

  if (classInfo.isPersonal) {
    throw new AppError(403, 'FORBIDDEN', 'Personal class cannot be deleted');
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
}
