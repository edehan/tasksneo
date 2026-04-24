import { AuthProvider, NotifChannel, prisma } from "@taskflow/db";

import { cacheDel, cacheDelPattern, cacheKeys } from "../lib/cache.js";
import { AppError } from "../lib/errors.js";
import { toUserProfile } from "../lib/http.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { removeObject } from "../lib/storage.js";
import {
	invalidateSessionCacheForUser,
	revokeAllBrowserSessions,
} from "./session.service.js";
import {
	hardDeleteTask,
	removeSubmissionAttachments,
	softDeleteTask,
	tryHardDeleteOrphanTask,
} from "./task-cleanup.service.js";

export async function getMyProfile(userId: string) {
	const [user, avatar] = await Promise.all([
		prisma.user.findUnique({
			where: { id: userId },
			include: {
				school: {
					select: {
						name: true,
					},
				},
			},
		}),
		prisma.attachment.findFirst({
			where: { avatarUserId: userId },
			select: { fileKey: true },
		}),
	]);

	if (!user) {
		throw new AppError(404, "USER_NOT_FOUND", "User not found");
	}

	return toUserProfile(user, avatar?.fileKey ?? null);
}

export async function updateMyProfile(
	userId: string,
	input: {
		nickname?: string | null;
		schoolId?: string | null;
		studentId?: string | null;
		timezone?: string;
	},
) {
	if (input.schoolId && !input.studentId) {
		throw new AppError(
			400,
			"STUDENT_ID_REQUIRED",
			"studentId is required when schoolId is provided",
		);
	}

	if (!input.schoolId && input.studentId) {
		throw new AppError(
			400,
			"SCHOOL_ID_REQUIRED",
			"schoolId is required when studentId is provided",
		);
	}

	if (input.schoolId) {
		const school = await prisma.school.findUnique({
			where: { id: input.schoolId },
		});

		if (!school) {
			throw new AppError(400, "SCHOOL_NOT_FOUND", "School does not exist");
		}
	}

	const user = await prisma.user.update({
		where: { id: userId },
		data: {
			nickname: input.nickname,
			schoolId: input.schoolId,
			studentId: input.studentId,
			...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
		},
		include: {
			school: {
				select: {
					name: true,
				},
			},
		},
	});

	return toUserProfile(user);
}

export async function updateMyPassword(
	userId: string,
	currentPassword: string,
	newPassword: string,
	currentSessionId: string,
) {
	const credential = await prisma.userCredential.findUnique({
		where: {
			userId_provider: {
				userId,
				provider: AuthProvider.LOCAL,
			},
		},
	});

	if (!credential?.passwordHash) {
		throw new AppError(
			400,
			"PASSWORD_NOT_AVAILABLE",
			"Local password is not available for this user",
		);
	}

	const valid = await verifyPassword(currentPassword, credential.passwordHash);

	if (!valid) {
		throw new AppError(
			401,
			"INVALID_CREDENTIALS",
			"Current password is incorrect",
		);
	}

	const passwordHash = await hashPassword(newPassword);

	await prisma.userCredential.update({
		where: {
			userId_provider: {
				userId,
				provider: AuthProvider.LOCAL,
			},
		},
		data: {
			passwordHash,
		},
	});

	// Keep the current session alive — the user is acting intentionally right
	// now — but kick every other browser session. MCP sessions are untouched.
	await revokeAllBrowserSessions(userId, currentSessionId);
}

export async function listMyNotificationPrefs(userId: string) {
	const prefs = await prisma.userNotificationPref.findMany({
		where: { userId },
		orderBy: {
			channel: "asc",
		},
	});

	if (prefs.length === 0) {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { email: true },
		});

		if (!user) {
			throw new AppError(404, "USER_NOT_FOUND", "User not found");
		}

		const created = await prisma.userNotificationPref.create({
			data: {
				userId,
				channel: NotifChannel.EMAIL,
				address: user.email,
				isEnabled: true,
			},
		});

		return [created];
	}

	return prefs;
}

export async function upsertMyNotificationPref(
	userId: string,
	input: { channel: NotifChannel; address: string; isEnabled?: boolean },
) {
	// For EMAIL channel, always use the account email — no custom address override
	let address = input.address;
	if (input.channel === NotifChannel.EMAIL) {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { email: true },
		});
		address = user?.email ?? input.address;
	}

	const pref = await prisma.userNotificationPref.upsert({
		where: {
			userId_channel: {
				userId,
				channel: input.channel,
			},
		},
		update: {
			address,
			isEnabled: input.isEnabled ?? true,
		},
		create: {
			userId,
			channel: input.channel,
			address,
			isEnabled: input.isEnabled ?? true,
		},
	});
	await cacheDel(cacheKeys.notifPrefs(userId));
	return pref;
}

async function removeUserAvatarAttachments(userId: string) {
	const avatars = await prisma.attachment.findMany({
		where: { avatarUserId: userId },
		select: { fileKey: true },
	});

	for (const avatar of avatars) {
		await removeObject(avatar.fileKey);
	}

	await prisma.attachment.deleteMany({ where: { avatarUserId: userId } });
}

async function deleteUserSubmissions(userId: string) {
	const submissions = await prisma.submission.findMany({
		where: { userId },
		select: {
			id: true,
			taskId: true,
		},
	});

	for (const submission of submissions) {
		await removeSubmissionAttachments(submission.id);
		await prisma.submission.delete({ where: { id: submission.id } });
		await cacheDel(cacheKeys.taskStats(submission.taskId));
		await tryHardDeleteOrphanTask(submission.taskId);
	}
}

async function deletePersonalClass(userId: string) {
	const personalClass = await prisma.class.findFirst({
		where: {
			ownerId: userId,
			isPersonal: true,
		},
		select: { id: true },
	});

	if (!personalClass) {
		return;
	}

	const tasks = await prisma.task.findMany({
		where: { classId: personalClass.id },
		select: {
			id: true,
			_count: {
				select: { submissions: true },
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

	await prisma.class.delete({ where: { id: personalClass.id } });
	await cacheDelPattern(cacheKeys.membershipClassPattern(personalClass.id));
	await cacheDel(cacheKeys.classDetail(personalClass.id));
}

export async function deleteMyAccount(userId: string) {
	const ownedSharedClasses = await prisma.class.findMany({
		where: {
			ownerId: userId,
			isPersonal: false,
		},
		select: {
			id: true,
			name: true,
		},
	});

	if (ownedSharedClasses.length > 0) {
		throw new AppError(
			400,
			"OWNED_CLASSES_EXIST",
			"Transfer or delete your owned classes before account deletion",
		);
	}

	await deleteUserSubmissions(userId);
	await deletePersonalClass(userId);
	await removeUserAvatarAttachments(userId);
	await invalidateSessionCacheForUser(userId);
	await prisma.user.delete({ where: { id: userId } });
	await cacheDel(cacheKeys.notifPrefs(userId));
}

export async function adminDeleteUser(userId: string) {
	await deleteUserSubmissions(userId);
	await deletePersonalClass(userId);
	await removeUserAvatarAttachments(userId);
	await invalidateSessionCacheForUser(userId);
	await prisma.user.delete({ where: { id: userId } });
	await cacheDel(cacheKeys.notifPrefs(userId));
}
