import { ClassRole, prisma } from '@taskflow/db';
import { randomBytes } from 'node:crypto';

import { AppError } from '../lib/errors.js';
import { toClassMember, toClassSummary } from '../lib/http.js';

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

async function assertClassMembership(classId: string, userId: string) {
  const membership = await prisma.classMember.findUnique({
    where: {
      classId_userId: {
        classId,
        userId,
      },
    },
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
  });

  if (membership) {
    return membership;
  }

  const existingClass = await prisma.class.findUnique({ where: { id: classId }, select: { id: true } });

  if (!existingClass) {
    throw new AppError(404, 'CLASS_NOT_FOUND', 'Class not found');
  }

  throw new AppError(403, 'FORBIDDEN', 'You are not a member of this class');
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

  const joinedClass = await prisma.class.findUnique({
    where: { id: targetClass.id },
    include: {
      _count: {
        select: {
          members: true,
        },
      },
    },
  });

  if (!joinedClass) {
    throw new AppError(404, 'CLASS_NOT_FOUND', 'Class not found');
  }

  return toClassSummary(joinedClass, ClassRole.MEMBER);
}

export async function getClassDetail(classId: string, userId: string) {
  const membership = await assertClassMembership(classId, userId);
  return toClassSummary(membership.class, membership.role);
}

export async function listClassMembers(classId: string, userId: string) {
  await assertClassMembership(classId, userId);

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
