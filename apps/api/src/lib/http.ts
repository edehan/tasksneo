import type { User } from '@taskflow/db';

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
