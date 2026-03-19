import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

import { AuthProvider, ClassRole, prisma } from '@taskflow/db';

const repoRoot = path.resolve(process.cwd(), '../..');
const localEnvPath = path.join(repoRoot, '.env');

if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
}

function assertLocalDatabase() {
  const databaseUrl = process.env.DATABASE_URL ?? '';

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for dev seed');
  }

  const isLocalHost = databaseUrl.includes('@localhost:') || databaseUrl.includes('@127.0.0.1:');

  if (!isLocalHost) {
    throw new Error('Refusing to seed non-local database. This script is local-only.');
  }
}

async function upsertUser(email: string, nickname: string, passwordHash: string) {
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      nickname,
      isActive: true,
      schoolId: null,
      studentId: null,
      timezone: 'UTC',
    },
    create: {
      email,
      nickname,
      isActive: true,
      timezone: 'UTC',
    },
  });

  await prisma.userCredential.upsert({
    where: {
      userId_provider: {
        userId: user.id,
        provider: AuthProvider.LOCAL,
      },
    },
    update: {
      passwordHash,
      providerUid: null,
    },
    create: {
      userId: user.id,
      provider: AuthProvider.LOCAL,
      providerUid: null,
      passwordHash,
    },
  });

  return user;
}

async function upsertClass(ownerId: string, input: { name: string; inviteCode: string; color: string }) {
  return prisma.class.upsert({
    where: {
      inviteCode: input.inviteCode,
    },
    update: {
      name: input.name,
      ownerId,
      isPersonal: false,
      schoolId: null,
      color: input.color,
      description: `${input.name} (local dev seed)`,
    },
    create: {
      name: input.name,
      ownerId,
      isPersonal: false,
      schoolId: null,
      inviteCode: input.inviteCode,
      color: input.color,
      description: `${input.name} (local dev seed)`,
    },
  });
}

async function ensureMember(classId: string, userId: string, role: ClassRole) {
  await prisma.classMember.upsert({
    where: {
      classId_userId: {
        classId,
        userId,
      },
    },
    update: {
      role,
    },
    create: {
      classId,
      userId,
      role,
    },
  });
}

async function ensurePersonalClass(user: { id: string; email: string; nickname: string | null }) {
  const className = `${user.nickname ?? user.email} Personal`;

  const existing = await prisma.class.findFirst({
    where: {
      ownerId: user.id,
      isPersonal: true,
    },
    select: {
      id: true,
    },
  });

  const personalClass = existing
    ? await prisma.class.update({
        where: { id: existing.id },
        data: {
          name: className,
          isPersonal: true,
          inviteCode: null,
          schoolId: null,
          description: 'Personal workspace (local dev seed)',
          color: '#6366f1',
        },
      })
    : await prisma.class.create({
        data: {
          name: className,
          ownerId: user.id,
          isPersonal: true,
          inviteCode: null,
          schoolId: null,
          description: 'Personal workspace (local dev seed)',
          color: '#6366f1',
        },
      });

  await ensureMember(personalClass.id, user.id, ClassRole.OWNER);
}

async function upsertTask(input: {
  classId: string;
  createdBy: string;
  title: string;
  startAtIso: string;
  dueAtIso: string;
  description: string;
}) {
  const existing = await prisma.task.findFirst({
    where: {
      classId: input.classId,
      title: input.title,
      deletedAt: null,
    },
  });

  if (existing) {
    return prisma.task.update({
      where: { id: existing.id },
      data: {
        createdBy: input.createdBy,
        startAt: new Date(input.startAtIso),
        dueAt: new Date(input.dueAtIso),
        description: input.description,
        allowLateSubmission: true,
        blockedBy: [],
        deletedAt: null,
      },
    });
  }

  return prisma.task.create({
    data: {
      classId: input.classId,
      createdBy: input.createdBy,
      title: input.title,
      startAt: new Date(input.startAtIso),
      dueAt: new Date(input.dueAtIso),
      description: input.description,
      allowLateSubmission: true,
      blockedBy: [],
    },
  });
}

async function upsertSubmission(input: {
  taskId: string;
  userId: string;
  submittedAtIso: string;
  content: string;
}) {
  const submittedAt = new Date(input.submittedAtIso);

  await prisma.submission.upsert({
    where: {
      taskId_userId: {
        taskId: input.taskId,
        userId: input.userId,
      },
    },
    update: {
      content: input.content,
      firstSubmittedAt: submittedAt,
      lastUpdatedAt: submittedAt,
      score: null,
      reviewerId: null,
      reviewedAt: null,
      reviewNote: null,
    },
    create: {
      taskId: input.taskId,
      userId: input.userId,
      content: input.content,
      firstSubmittedAt: submittedAt,
      lastUpdatedAt: submittedAt,
    },
  });

  await prisma.taskUserState.upsert({
    where: {
      taskId_userId: {
        taskId: input.taskId,
        userId: input.userId,
      },
    },
    update: {
      viewedAt: submittedAt,
    },
    create: {
      taskId: input.taskId,
      userId: input.userId,
      viewedAt: submittedAt,
      tags: [],
    },
  });
}

async function main() {
  assertLocalDatabase();

  const passwordHash = await bcrypt.hash('12345678', 10);

  const userA = await upsertUser('a@example.com', 'User A', passwordHash);
  const userB = await upsertUser('b@example.com', 'User B', passwordHash);
  const userC = await upsertUser('c@example.com', 'User C', passwordHash);

  await ensurePersonalClass(userA);
  await ensurePersonalClass(userB);
  await ensurePersonalClass(userC);

  const class1 = await upsertClass(userA.id, {
    name: 'Class 1',
    inviteCode: 'DEV-CLASS-1-OPEN',
    color: '#2563eb',
  });
  const class2 = await upsertClass(userA.id, {
    name: 'Class 2',
    inviteCode: 'DEV-CLASS-2-OPEN',
    color: '#16a34a',
  });
  const class3 = await upsertClass(userA.id, {
    name: 'Class 3',
    inviteCode: 'DEV-CLASS-3-OPEN',
    color: '#ea580c',
  });

  for (const classRow of [class1, class2, class3]) {
    await ensureMember(classRow.id, userA.id, ClassRole.OWNER);
    await ensureMember(classRow.id, userB.id, ClassRole.MEMBER);
    await ensureMember(classRow.id, userC.id, ClassRole.MEMBER);
  }

  const task1 = await upsertTask({
    classId: class1.id,
    createdBy: userA.id,
    title: 'Class 1 Task',
    startAtIso: '2026-03-10T00:00:00.000Z',
    dueAtIso: '2026-04-01T23:59:59.000Z',
    description: '# Class 1 Task\n\n- Solve exercise set A\n- Upload any notes if needed',
  });

  const task2 = await upsertTask({
    classId: class2.id,
    createdBy: userA.id,
    title: 'Class 2 Task',
    startAtIso: '2026-03-15T00:00:00.000Z',
    dueAtIso: '2026-04-01T23:59:59.000Z',
    description: '# Class 2 Task\n\nWrite a short markdown report with your key findings.',
  });

  await upsertSubmission({
    taskId: task1.id,
    userId: userB.id,
    submittedAtIso: '2026-03-18T10:00:00.000Z',
    content: '## Submission for Class 1\n\nFinished the assignment and verified all answers.',
  });

  await upsertSubmission({
    taskId: task2.id,
    userId: userB.id,
    submittedAtIso: '2026-03-18T11:00:00.000Z',
    content: '## Submission for Class 2\n\nHere is my markdown response with the requested summary.',
  });

  console.log('Local dev seed ready.');
  console.log('Users: a@example.com / b@example.com / c@example.com (password: 12345678)');
  console.log('Classes invite codes: DEV-CLASS-1-OPEN, DEV-CLASS-2-OPEN, DEV-CLASS-3-OPEN');
}

main()
  .catch((error) => {
    console.error('Dev seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
