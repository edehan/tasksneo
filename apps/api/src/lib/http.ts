import type { ClassRole, User } from '@taskflow/db';

export function toUserProfile(user: User & { school: { name: string } | null }) {
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    schoolId: user.schoolId,
    schoolName: user.school?.name ?? null,
    studentId: user.studentId,
    isActive: user.isActive,
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

export function toClassSummary(classInfo: ClassSummarySource, myRole: ClassRole) {
  return {
    id: classInfo.id,
    name: classInfo.name,
    description: classInfo.description,
    color: classInfo.color,
    isPersonal: classInfo.isPersonal,
    ownerId: classInfo.ownerId,
    schoolId: classInfo.schoolId,
    inviteCode: myRole === 'MEMBER' ? null : classInfo.inviteCode,
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
    email: member.user.email,
    nickname: member.user.nickname,
    role: member.role,
    joinedAt: member.joinedAt.toISOString(),
  };
}
