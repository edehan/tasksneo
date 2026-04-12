import { AuthProvider, ClassRole, prisma } from "@taskflow/db";
import bcrypt from "bcryptjs";

import { AppError } from "../lib/errors.js";
import { toUserProfile } from "../lib/http.js";
import {
	createUniquePublicId,
	isUniqueConstraintError,
} from "../lib/public-id.js";
import { createBrowserSession } from "./session.service.js";
import { assertRegistrationOpen } from "./system-config.service.js";

const SALT_ROUNDS = 10;
const PERSONAL_CLASS_NAME = "个人空间";

export interface RegisterInput {
	email: string;
	password: string;
	nickname?: string | null;
	schoolId?: string | null;
	studentId?: string | null;
	timezone?: string;
}

export interface SessionMetadata {
	trustDevice: boolean;
	userAgent: string | null;
	ipAddress: string | null;
}

export interface LoginInput {
	email: string;
	password: string;
	sessionMeta: SessionMetadata;
}

/**
 * Shared helper: creates user, credential, and personal class in a transaction.
 * Used by both direct registration and email-verified registration.
 */
export async function createUserWithPersonalClass(
	input: RegisterInput,
	sessionMeta: SessionMetadata,
) {
	await assertRegistrationOpen();

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

	const existingUser = await prisma.user.findUnique({
		where: { email: input.email },
	});
	if (existingUser) {
		throw new AppError(409, "EMAIL_EXISTS", "Email already registered");
	}

	const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

	let user = null;

	for (let attempt = 0; attempt < 8; attempt += 1) {
		const personalClassPublicId = await createUniquePublicId(
			async (publicId) => {
				const existing = await prisma.class.findUnique({
					where: { publicId },
					select: { id: true },
				});

				return Boolean(existing);
			},
		);

		try {
			user = await prisma.$transaction(async (tx) => {
				const createdUser = await tx.user.create({
					data: {
						email: input.email,
						nickname: input.nickname ?? null,
						schoolId: input.schoolId ?? null,
						studentId: input.studentId ?? null,
						...(input.timezone ? { timezone: input.timezone } : {}),
					},
				});

				await tx.userCredential.create({
					data: {
						userId: createdUser.id,
						provider: AuthProvider.LOCAL,
						passwordHash,
					},
				});

				const personalClass = await tx.class.create({
					data: {
						publicId: personalClassPublicId,
						name: PERSONAL_CLASS_NAME,
						isPersonal: true,
						inviteCode: null,
						ownerId: createdUser.id,
					},
				});

				await tx.classMember.create({
					data: {
						classId: personalClass.id,
						userId: createdUser.id,
						role: ClassRole.OWNER,
					},
				});

				return createdUser;
			});
			break;
		} catch (error) {
			if (isUniqueConstraintError(error, ["public_id", "publicId"])) {
				continue;
			}

			throw error;
		}
	}

	if (!user) {
		throw new AppError(
			500,
			"PUBLIC_ID_GENERATION_FAILED",
			"Failed to generate public id",
		);
	}

	const fullUser = await prisma.user.findUnique({
		where: { id: user.id },
		include: {
			school: {
				select: {
					name: true,
				},
			},
		},
	});

	if (!fullUser) {
		throw new AppError(500, "USER_NOT_FOUND", "Failed to load created user");
	}

	const { token } = await createBrowserSession({
		userId: fullUser.id,
		isTrusted: sessionMeta.trustDevice,
		userAgent: sessionMeta.userAgent,
		ipAddress: sessionMeta.ipAddress,
	});

	return {
		token,
		user: toUserProfile(fullUser),
	};
}

export async function register(
	input: RegisterInput,
	sessionMeta: SessionMetadata,
) {
	return createUserWithPersonalClass(input, sessionMeta);
}

export async function login(input: LoginInput) {
	const user = await prisma.user.findUnique({
		where: { email: input.email },
		include: {
			school: {
				select: {
					name: true,
				},
			},
			credentials: true,
		},
	});

	if (!user) {
		throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
	}

	if (!user.isActive) {
		throw new AppError(403, "USER_INACTIVE", "Account is disabled");
	}

	const localCredential = user.credentials.find(
		(credential) => credential.provider === AuthProvider.LOCAL,
	);

	if (!localCredential?.passwordHash) {
		throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
	}

	const passwordMatched = await bcrypt.compare(
		input.password,
		localCredential.passwordHash,
	);

	if (!passwordMatched) {
		throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
	}

	const { token } = await createBrowserSession({
		userId: user.id,
		isTrusted: input.sessionMeta.trustDevice,
		userAgent: input.sessionMeta.userAgent,
		ipAddress: input.sessionMeta.ipAddress,
	});

	return {
		token,
		user: toUserProfile(user),
	};
}
