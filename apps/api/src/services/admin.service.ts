import { AuthProvider, NotifChannel, prisma } from "@taskflow/db";

import { cacheDel, cacheKeys } from "../lib/cache.js";
import { AppError } from "../lib/errors.js";
import { toUserProfile } from "../lib/http.js";
import { sendEmail } from "../lib/mailer.js";
import { hashPassword } from "../lib/password.js";
import { createSchool, deleteSchool, listSchools } from "./school.service.js";
import { invalidateSessionCacheForUser } from "./session.service.js";
import {
	getConfigMap,
	getConfigValue,
	updateConfig,
} from "./system-config.service.js";
import { adminDeleteUser } from "./user.service.js";

export async function getAdminConfig() {
	const map = await getConfigMap();
	return Object.fromEntries(map.entries());
}

export async function patchAdminConfig(entries: Record<string, string>) {
	const updated = await updateConfig(entries);
	return Object.fromEntries(updated.entries());
}

export async function listAdminUsers() {
	const users = await prisma.user.findMany({
		include: {
			school: {
				select: {
					name: true,
				},
			},
		},
		orderBy: {
			createdAt: "desc",
		},
	});

	return users.map((user) => toUserProfile(user));
}

export async function updateAdminUser(
	userId: string,
	input: { isActive?: boolean; password?: string },
) {
	const user = await prisma.user.findUnique({ where: { id: userId } });

	if (!user) {
		throw new AppError(404, "USER_NOT_FOUND", "User not found");
	}

	if (input.isActive !== undefined) {
		await prisma.user.update({
			where: { id: userId },
			data: { isActive: input.isActive },
		});
		await invalidateSessionCacheForUser(userId);
		await cacheDel(cacheKeys.userProfile(userId));
	}

	if (input.password) {
		const passwordHash = await hashPassword(input.password);

		await prisma.userCredential.upsert({
			where: {
				userId_provider: {
					userId,
					provider: AuthProvider.LOCAL,
				},
			},
			create: {
				userId,
				provider: AuthProvider.LOCAL,
				passwordHash,
			},
			update: {
				passwordHash,
			},
		});
	}

	const updated = await prisma.user.findUnique({
		where: { id: userId },
		include: {
			school: { select: { name: true } },
		},
	});

	if (!updated) {
		throw new AppError(404, "USER_NOT_FOUND", "User not found");
	}

	return toUserProfile(updated, null);
}

export async function deleteAdminUser(userId: string) {
	const user = await prisma.user.findUnique({ where: { id: userId } });

	if (!user) {
		throw new AppError(404, "USER_NOT_FOUND", "User not found");
	}

	await adminDeleteUser(userId);
}

export async function listAdminSchools() {
	return listSchools();
}

export async function createAdminSchool(name: string) {
	return createSchool(name);
}

export async function deleteAdminSchool(schoolId: string) {
	return deleteSchool(schoolId);
}

export async function sendAdminTestEmail(to: string) {
	const sentAt = new Date().toISOString();
	const instanceId = process.env.HOSTNAME ?? "unknown";
	const appTitle = (await getConfigValue("app.title"))?.trim() || "TaskNeo";
	const provider = (await getConfigValue("email.provider"))?.trim() || "smtp";
	const providerLabel = provider === "cyberpanel" ? "CyberPanel" : "SMTP";

	await sendEmail(
		to,
		`[${appTitle}] ${providerLabel} 测试邮件`,
		`这是一封来自 ${appTitle} 管理后台的 ${providerLabel} 测试邮件。\n\n发送时间（UTC）：${sentAt}\n实例：${instanceId}`,
	);
}

export async function ensureEmailPrefForUser(userId: string, email: string) {
	await prisma.userNotificationPref.upsert({
		where: {
			userId_channel: {
				userId,
				channel: NotifChannel.EMAIL,
			},
		},
		create: {
			userId,
			channel: NotifChannel.EMAIL,
			address: email,
			isEnabled: true,
		},
		update: {},
	});
}
