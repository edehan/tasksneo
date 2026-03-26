import { AuthProvider, NotifChannel, prisma } from "@taskflow/db";
import bcrypt from "bcryptjs";

import { AppError } from "../lib/errors.js";
import { toUserProfile } from "../lib/http.js";
import { sendEmail } from "../lib/mailer.js";
import { createSchool, deleteSchool, listSchools } from "./school.service.js";
import { getConfigMap, updateConfig } from "./system-config.service.js";
import { adminDeleteUser } from "./user.service.js";

const SALT_ROUNDS = 10;

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
	}

	if (input.password) {
		const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

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

	return toUserProfile(updated);
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

	await sendEmail(
		to,
		"[TaskFlow] SMTP Test Email",
		`This is a test email from TaskFlow admin control plane.\n\nSent at (UTC): ${sentAt}\nInstance: ${instanceId}`,
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
