import { ClassRole, prisma } from '@taskflow/db';

import { AppError } from '../lib/errors.js';
import { getPresignedUrl } from '../lib/storage.js';

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
    },
  });

  if (!task) {
    throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found');
  }

  if (task.classId) {
    const membership = await isClassMember(task.classId, userId);

    if (!membership) {
      throw new AppError(403, 'FORBIDDEN', 'No permission to access task file');
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
    throw new AppError(403, 'FORBIDDEN', 'No permission to access task file');
  }
}

async function assertSubmissionAttachmentAccess(submissionId: string, userId: string) {
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
    throw new AppError(404, 'SUBMISSION_NOT_FOUND', 'Submission not found');
  }

  if (submission.userId === userId) {
    return;
  }

  if (!submission.task.classId) {
    throw new AppError(403, 'FORBIDDEN', 'No permission to access submission file');
  }

  const membership = await isClassMember(submission.task.classId, userId);

  if (!membership || (membership.role !== ClassRole.OWNER && membership.role !== ClassRole.ADMIN)) {
    throw new AppError(403, 'FORBIDDEN', 'No permission to access submission file');
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
    throw new AppError(404, 'FILE_NOT_FOUND', 'File not found');
  }

  if (attachment.taskId) {
    await assertTaskAttachmentAccess(attachment.taskId, userId);
  } else if (attachment.submissionId) {
    await assertSubmissionAttachmentAccess(attachment.submissionId, userId);
  } else if (attachment.classId) {
    const membership = await isClassMember(attachment.classId, userId);

    if (!membership) {
      throw new AppError(403, 'FORBIDDEN', 'No permission to access class file');
    }
  } else if (attachment.avatarUserId) {
    if (attachment.avatarUserId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'No permission to access avatar');
    }
  }

  return getPresignedUrl(fileKey, 300);
}
