import { ClassRole, prisma } from '@taskflow/db';

import { AppError } from '../lib/errors.js';
import { toAttachmentMeta, toSubmission, toTaskSummary, toTaskUserState } from '../lib/http.js';
import { getMembershipOrThrow, requireOwnerOrAdmin } from './policy.service.js';
import { enqueueTaskPublishedNotifications } from './notification.service.js';
import { hardDeleteTask, removeSubmissionAttachments, softDeleteTask, tryHardDeleteOrphanTask } from './task-cleanup.service.js';

interface CreateTaskInput {
  title: string;
  description?: string | null;
  startAt?: string | null;
  dueAt?: string | null;
  allowLateSubmission?: boolean;
  blockedBy?: string[];
}

interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  startAt?: string | null;
  dueAt?: string | null;
  allowLateSubmission?: boolean;
  blockedBy?: string[];
}

interface UpdateTaskUserStateInput {
  tags?: string[];
  sortOrder?: number;
}

function parseDate(value?: string | null): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, 'INVALID_DATE', 'Invalid datetime format');
  }

  return date;
}

async function assertTaskAccess(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      class: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!task) {
    throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found');
  }

  if (task.classId) {
    const membership = await getMembershipOrThrow(task.classId, userId);

    return {
      task,
      classMembership: membership,
    };
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
    throw new AppError(403, 'FORBIDDEN', 'You do not have access to this task');
  }

  return {
    task,
    classMembership: null,
  };
}

async function getTaskWithUserState(taskId: string, userId: string) {
  const [task, state] = await Promise.all([
    prisma.task.findUnique({
      where: { id: taskId },
      include: {
        class: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.taskUserState.findUnique({
      where: {
        taskId_userId: {
          taskId,
          userId,
        },
      },
    }),
  ]);

  if (!task) {
    throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found');
  }

  return toTaskSummary(task, state);
}

export async function listClassTasks(classId: string, userId: string) {
  await getMembershipOrThrow(classId, userId);

  const [tasks, states] = await Promise.all([
    prisma.task.findMany({
      where: {
        classId,
        deletedAt: null,
      },
      include: {
        class: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.taskUserState.findMany({
      where: {
        userId,
        task: {
          classId,
          deletedAt: null,
        },
      },
    }),
  ]);

  const stateMap = new Map(states.map((state) => [state.taskId, state]));

  return tasks.map((task) => toTaskSummary(task, stateMap.get(task.id) ?? null));
}

export async function createClassTask(classId: string, userId: string, input: CreateTaskInput) {
  const membership = await getMembershipOrThrow(classId, userId);
  requireOwnerOrAdmin(membership);

  const task = await prisma.task.create({
    data: {
      classId,
      createdBy: userId,
      title: input.title,
      description: input.description ?? null,
      startAt: parseDate(input.startAt),
      dueAt: parseDate(input.dueAt),
      allowLateSubmission: input.allowLateSubmission ?? true,
      blockedBy: input.blockedBy ?? [],
    },
    include: {
      class: {
        select: {
          name: true,
        },
      },
    },
  });

  const memberIds = await prisma.classMember.findMany({
    where: { classId },
    select: { userId: true },
  });

  await enqueueTaskPublishedNotifications({
    taskId: task.id,
    className: task.class?.name ?? '',
    taskTitle: task.title,
    dueAt: task.dueAt,
    memberUserIds: memberIds.map((item) => item.userId),
  });

  return toTaskSummary(task, null);
}

export async function getTaskDetail(taskId: string, userId: string) {
  const { task, classMembership } = await assertTaskAccess(taskId, userId);

  const [userState, attachments, stats] = await Promise.all([
    prisma.taskUserState.findUnique({
      where: {
        taskId_userId: {
          taskId,
          userId,
        },
      },
    }),
    prisma.attachment.findMany({ where: { taskId } }),
    classMembership && (classMembership.role === ClassRole.OWNER || classMembership.role === ClassRole.ADMIN)
      ? Promise.all([
          prisma.classMember.count({ where: { classId: task.classId ?? undefined } }),
          prisma.taskUserState.count({ where: { taskId, viewedAt: { not: null } } }),
          prisma.submission.count({ where: { taskId } }),
        ])
      : null,
  ]);

  return {
    ...toTaskSummary(task, userState),
    description: task.description,
    attachments: attachments.map(toAttachmentMeta),
    stats:
      stats && task.classId
        ? {
            memberCount: stats[0],
            viewedCount: stats[1],
            submittedCount: stats[2],
          }
        : null,
  };
}

export async function updateTask(taskId: string, userId: string, input: UpdateTaskInput) {
  const { task, classMembership } = await assertTaskAccess(taskId, userId);

  if (!classMembership) {
    throw new AppError(403, 'FORBIDDEN', 'Only class admin can update task');
  }

  requireOwnerOrAdmin(classMembership);

  await prisma.task.update({
    where: { id: taskId },
    data: {
      title: input.title,
      description: input.description,
      startAt: parseDate(input.startAt),
      dueAt: parseDate(input.dueAt),
      allowLateSubmission: input.allowLateSubmission,
      blockedBy: input.blockedBy,
      updatedAt: new Date(),
    },
  });

  return getTaskWithUserState(task.id, userId);
}

export async function deleteTask(taskId: string, userId: string) {
  const { task, classMembership } = await assertTaskAccess(taskId, userId);

  if (!classMembership) {
    throw new AppError(403, 'FORBIDDEN', 'Only class admin can delete task');
  }

  requireOwnerOrAdmin(classMembership);

  const submissionCount = await prisma.submission.count({ where: { taskId } });

  if (submissionCount === 0) {
    await hardDeleteTask(taskId);
    return;
  }

  await softDeleteTask(taskId, false);

  if (!task.classId) {
    await tryHardDeleteOrphanTask(taskId);
  }
}

export async function markTaskViewed(taskId: string, userId: string) {
  await assertTaskAccess(taskId, userId);

  const existing = await prisma.taskUserState.findUnique({
    where: {
      taskId_userId: {
        taskId,
        userId,
      },
    },
  });

  if (!existing) {
    await prisma.taskUserState.create({
      data: {
        taskId,
        userId,
        viewedAt: new Date(),
        tags: [],
      },
    });

    return;
  }

  if (!existing.viewedAt) {
    await prisma.taskUserState.update({
      where: {
        taskId_userId: {
          taskId,
          userId,
        },
      },
      data: {
        viewedAt: new Date(),
      },
    });
  }
}

export async function updateTaskUserState(taskId: string, userId: string, input: UpdateTaskUserStateInput) {
  await assertTaskAccess(taskId, userId);

  const state = await prisma.taskUserState.upsert({
    where: {
      taskId_userId: {
        taskId,
        userId,
      },
    },
    update: {
      tags: input.tags,
      sortOrder: input.sortOrder,
    },
    create: {
      taskId,
      userId,
      tags: input.tags ?? [],
      sortOrder: input.sortOrder ?? 0,
    },
  });

  return toTaskUserState(state);
}

export async function listTaskSubmissions(taskId: string, userId: string) {
  const { task, classMembership } = await assertTaskAccess(taskId, userId);

  if (!classMembership || !task.classId) {
    throw new AppError(403, 'FORBIDDEN', 'Only class admin can view all submissions');
  }

  requireOwnerOrAdmin(classMembership);

  const rows = await prisma.classMember.findMany({
    where: {
      classId: task.classId,
    },
    include: {
      user: {
        include: {
          school: {
            select: {
              name: true,
            },
          },
        },
      },
      class: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      joinedAt: 'asc',
    },
  });

  const submissions = await prisma.submission.findMany({
    where: { taskId },
  });

  const submissionMap = new Map(submissions.map((submission) => [submission.userId, submission]));

  return rows.map((row) => {
    const submission = submissionMap.get(row.userId);

    return {
      userId: row.userId,
      nickname: row.user.nickname,
      email: row.user.email,
      schoolName: row.user.school?.name ?? null,
      studentId: row.user.studentId,
      role: row.role,
      submitted: Boolean(submission),
      submission: submission ? toSubmission(submission) : null,
    };
  });
}

export async function getMySubmission(taskId: string, userId: string) {
  await assertTaskAccess(taskId, userId);

  const submission = await prisma.submission.findUnique({
    where: {
      taskId_userId: {
        taskId,
        userId,
      },
    },
    include: {
      attachments: true,
    },
  });

  if (!submission) {
    return null;
  }

  return {
    ...toSubmission(submission),
    attachments: submission.attachments.map(toAttachmentMeta),
  };
}

export async function upsertMySubmission(taskId: string, userId: string, attachmentRecords: Array<{
  fileKey: string;
  originalName: string;
  mimeType: string | null;
  sizeBytes: bigint;
}>) {
  await assertTaskAccess(taskId, userId);

  const existingSubmission = await prisma.submission.findUnique({
    where: {
      taskId_userId: {
        taskId,
        userId,
      },
    },
    include: {
      attachments: {
        select: {
          fileKey: true,
        },
      },
    },
  });

  let submissionId = existingSubmission?.id;

  if (!submissionId) {
    const submission = await prisma.submission.create({
      data: {
        taskId,
        userId,
      },
    });

    submissionId = submission.id;
  } else {
    await removeSubmissionAttachments(submissionId);
  }

  for (const attachment of attachmentRecords) {
    await prisma.attachment.create({
      data: {
        fileKey: attachment.fileKey,
        originalName: attachment.originalName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        uploadedBy: userId,
        submissionId,
      },
    });
  }

  await prisma.taskUserState.upsert({
    where: {
      taskId_userId: {
        taskId,
        userId,
      },
    },
    update: {},
    create: {
      taskId,
      userId,
      tags: [],
      viewedAt: new Date(),
    },
  });

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { attachments: true },
  });

  if (!submission) {
    throw new AppError(404, 'SUBMISSION_NOT_FOUND', 'Submission not found');
  }

  return {
    ...toSubmission(submission),
    attachments: submission.attachments.map(toAttachmentMeta),
  };
}

export async function addTaskAttachments(taskId: string, userId: string, attachmentRecords: Array<{
  fileKey: string;
  originalName: string;
  mimeType: string | null;
  sizeBytes: bigint;
}>) {
  const { classMembership } = await assertTaskAccess(taskId, userId);

  if (!classMembership) {
    throw new AppError(403, 'FORBIDDEN', 'Only class admin can upload task attachments');
  }

  requireOwnerOrAdmin(classMembership);

  const created = [] as Array<{
    id: string;
    fileKey: string;
    originalName: string;
    renamedFile: string | null;
    mimeType: string | null;
    sizeBytes: bigint | null;
    createdAt: Date;
  }>;

  for (const attachment of attachmentRecords) {
    const row = await prisma.attachment.create({
      data: {
        fileKey: attachment.fileKey,
        originalName: attachment.originalName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        uploadedBy: userId,
        taskId,
      },
    });

    created.push(row);
  }

  return created.map(toAttachmentMeta);
}

export async function gradeSubmission(taskId: string, submissionId: string, userId: string, input: {
  score?: string | null;
  reviewNote?: string | null;
}) {
  const { classMembership } = await assertTaskAccess(taskId, userId);

  if (!classMembership) {
    throw new AppError(403, 'FORBIDDEN', 'Only class admin can grade submissions');
  }

  requireOwnerOrAdmin(classMembership);

  const submission = await prisma.submission.findUnique({ where: { id: submissionId } });

  if (!submission || submission.taskId !== taskId) {
    throw new AppError(404, 'SUBMISSION_NOT_FOUND', 'Submission not found');
  }

  const updated = await prisma.submission.update({
    where: { id: submissionId },
    data: {
      score: input.score ? input.score : null,
      reviewNote: input.reviewNote ?? null,
      reviewerId: userId,
      reviewedAt: new Date(),
    },
  });

  return toSubmission(updated);
}

export async function exportTaskSubmissionsCsv(taskId: string, userId: string) {
  const { task, classMembership } = await assertTaskAccess(taskId, userId);

  if (!classMembership || !task.classId) {
    throw new AppError(403, 'FORBIDDEN', 'Only class admin can export csv');
  }

  requireOwnerOrAdmin(classMembership);

  const members = await prisma.classMember.findMany({
    where: { classId: task.classId },
    include: {
      user: {
        include: {
          school: {
            select: { name: true },
          },
        },
      },
      class: {
        select: {
          name: true,
        },
      },
    },
  });

  const submissions = await prisma.submission.findMany({ where: { taskId } });
  const submissionMap = new Map(submissions.map((submission) => [submission.userId, submission]));

  const rows = [
    ['昵称', '学校', '学号', '班级', '任务名称', '首次提交时间', '最后修改时间', '成绩'],
    ...members.map((member) => {
      const submission = submissionMap.get(member.userId);

      return [
        member.user.nickname ?? member.user.email,
        member.user.school?.name ?? '',
        member.user.studentId ?? '',
        member.class.name,
        task.title,
        submission?.firstSubmittedAt.toISOString() ?? '',
        submission?.lastUpdatedAt.toISOString() ?? '',
        submission?.score ? String(submission.score) : '',
      ];
    }),
  ];

  return rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
}

export async function renameTaskSubmissionAttachments(taskId: string, userId: string) {
  const { task, classMembership } = await assertTaskAccess(taskId, userId);

  if (!classMembership || !task.classId) {
    throw new AppError(403, 'FORBIDDEN', 'Only class admin can rename attachments');
  }

  requireOwnerOrAdmin(classMembership);

  const submissions = await prisma.submission.findMany({
    where: { taskId },
    include: {
      user: true,
      attachments: true,
      task: {
        include: {
          class: true,
        },
      },
    },
  });

  for (const submission of submissions) {
    for (const attachment of submission.attachments) {
      const displayName = [
        submission.task.class?.name ?? 'UnknownClass',
        submission.user.nickname ?? submission.user.email,
        submission.user.studentId ?? '',
        attachment.originalName,
      ]
        .filter((part) => part)
        .join('_');

      await prisma.attachment.update({
        where: { id: attachment.id },
        data: {
          renamedFile: displayName,
        },
      });
    }
  }
}
