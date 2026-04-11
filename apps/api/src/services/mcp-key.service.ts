import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@taskflow/db";

import { AppError } from "../lib/errors.js";
import { toMcpKey, toUserProfile } from "../lib/http.js";
import {
	createMcpSession,
	revokeMcpSessionsByKeyId,
} from "./session.service.js";

const MAX_KEYS_PER_USER = 10;
const KEY_PREFIX = "tfmcp_";

function generateKey(): { raw: string; hash: string; prefix: string } {
	const bytes = randomBytes(24);
	const raw = `${KEY_PREFIX}${bytes.toString("base64url")}`;
	const hash = createHash("sha256").update(raw).digest("hex");
	const prefix = raw.slice(0, 12);
	return { raw, hash, prefix };
}

function hashKey(raw: string): string {
	return createHash("sha256").update(raw).digest("hex");
}

export async function createMcpKey(userId: string, name: string) {
	const activeCount = await prisma.mcpKey.count({
		where: { userId, revokedAt: null },
	});

	if (activeCount >= MAX_KEYS_PER_USER) {
		throw new AppError(
			400,
			"MCP_KEY_LIMIT",
			`Maximum ${MAX_KEYS_PER_USER} active keys allowed`,
		);
	}

	const { raw, hash, prefix } = generateKey();

	const key = await prisma.mcpKey.create({
		data: {
			userId,
			name: name.trim(),
			keyHash: hash,
			keyPrefix: prefix,
		},
	});

	return {
		...toMcpKey(key),
		key: raw,
	};
}

export async function listMcpKeys(userId: string) {
	const keys = await prisma.mcpKey.findMany({
		where: { userId },
		orderBy: { createdAt: "desc" },
	});

	return keys.map(toMcpKey);
}

export async function revokeMcpKey(userId: string, keyId: string) {
	const key = await prisma.mcpKey.findUnique({ where: { id: keyId } });

	if (!key || key.userId !== userId) {
		throw new AppError(404, "MCP_KEY_NOT_FOUND", "Key not found");
	}

	if (key.revokedAt) {
		throw new AppError(400, "MCP_KEY_ALREADY_REVOKED", "Key already revoked");
	}

	const updated = await prisma.mcpKey.update({
		where: { id: keyId },
		data: { revokedAt: new Date() },
	});

	// Revoke any MCP sessions that were minted from this key so existing
	// connection tokens stop working immediately.
	await revokeMcpSessionsByKeyId(keyId);

	return toMcpKey(updated);
}

export async function exchangeMcpKey(
	rawKey: string,
	meta: { userAgent: string | null; ipAddress: string | null },
) {
	if (!rawKey.startsWith(KEY_PREFIX)) {
		throw new AppError(401, "MCP_KEY_INVALID", "Invalid MCP key format");
	}

	const hash = hashKey(rawKey);

	const key = await prisma.mcpKey.findFirst({
		where: { keyHash: hash },
		include: {
			user: {
				include: {
					school: { select: { name: true } },
				},
			},
		},
	});

	if (!key) {
		throw new AppError(401, "MCP_KEY_INVALID", "Invalid MCP key");
	}

	if (key.revokedAt) {
		throw new AppError(401, "MCP_KEY_REVOKED", "This key has been revoked");
	}

	if (key.expiresAt && key.expiresAt < new Date()) {
		throw new AppError(401, "MCP_KEY_EXPIRED", "This key has expired");
	}

	if (!key.user.isActive) {
		throw new AppError(403, "USER_INACTIVE", "Account is disabled");
	}

	await prisma.mcpKey.update({
		where: { id: key.id },
		data: { lastUsedAt: new Date() },
	});

	const { token } = await createMcpSession({
		userId: key.user.id,
		mcpKeyId: key.id,
		// Inherit the underlying key's expiry — null means "never expires".
		expiresAt: key.expiresAt,
		userAgent: meta.userAgent,
		ipAddress: meta.ipAddress,
	});

	return {
		token,
		user: toUserProfile(key.user),
	};
}
