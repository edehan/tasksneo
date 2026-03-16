import { prisma } from '@taskflow/db';

import { removeObject } from '../lib/storage.js';

export async function removeTaskAttachments(taskId: string) {
  const attachments = await prisma.attachment.findMany({
    where: {
      taskId,
    },
    select: {
      id: true,
      fileKey: true,
    },
  });

  for (const attachment of attachments) {
    await removeObject(attachment.fileKey);
  }

  await prisma.attachment.deleteMany({ where: { taskId } });
}

export async function removeSubmissionAttachments(submissionId: string) {
  const attachments = await prisma.attachment.findMany({
    where: {
      submissionId,
    },
    select: {
      fileKey: true,
    },
  });

  for (const attachment of attachments) {
    await removeObject(attachment.fileKey);
  }

  await prisma.attachment.deleteMany({ where: { submissionId } });
}

export async function tryHardDeleteOrphanTask(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      classId: true,
      _count: {
        select: {
          submissions: true,
        },
      },
    },
  });

  if (!task) {
    return;
  }

  if (task.classId !== null || task._count.submissions > 0) {
    return;
  }

  await removeTaskAttachments(task.id);
  await prisma.task.delete({ where: { id: task.id } });
}

export async function softDeleteTask(taskId: string, detachClass: boolean) {
  await removeTaskAttachments(taskId);

  await prisma.notificationJob.deleteMany({ where: { taskId } });

  await prisma.task.update({
    where: { id: taskId },
    data: {
      deletedAt: new Date(),
      title: '',
      description: null,
      classId: detachClass ? null : undefined,
    },
  });
}

export async function hardDeleteTask(taskId: string) {
  await removeTaskAttachments(taskId);
  await prisma.task.delete({ where: { id: taskId } });
}
