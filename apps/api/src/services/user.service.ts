import { prisma } from '@taskflow/db';

import { AppError } from '../lib/errors.js';
import { toUserProfile } from '../lib/http.js';

export async function getMyProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      school: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  return toUserProfile(user);
}
