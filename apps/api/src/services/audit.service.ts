import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { type AuditActorType, Prisma, prisma } from "@taskflow/db";

import { rootLogger } from "../lib/logger.js";

const HASH_ALGORITHM = "HMAC-SHA256";
const HMAC_DIGEST = "sha256";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_METADATA_CANONICAL_BYTES = 8 * 1024;

type AuditMetadata = Prisma.InputJsonValue;

export interface AuditActor {
	type: AuditActorType;
	userId?: string | null;
}

export interface RecordAuditLogInput {
	action: string;
	actor: AuditActor;
	targetType?: string | null;
	targetId?: string | null;
	classId?: string | null;
	metadata?: AuditMetadata;
	ipAddress?: string | null;
	userAgent?: string | null;
	requestId?: string | null;
}

export interface AuditLogItem {
	id: string;
	sequence: string;
	action: string;
	actorType: AuditActorType;
	actorUserId: string | null;
	targetType: string | null;
	targetId: string | null;
	classId: string | null;
	metadata: Prisma.JsonValue | null;
	ipAddress: string | null;
	userAgent: string | null;
	requestId: string | null;
	prevHash: string | null;
	entryHash: string;
	hashAlgorithm: string;
	hashKeyId: string;
	createdAt: string;
}

export interface ListAuditLogsQuery {
	limit?: number;
	cursor?: string;
	action?: string;
	actorUserId?: string;
	targetType?: string;
	targetId?: string;
	classId?: string;
	from?: Date;
	to?: Date;
}

export interface VerifyAuditLogsQuery {
	from?: Date;
	to?: Date;
}

export interface AuditVerifyResult {
	valid: boolean;
	checkedCount: number;
	lastSequence: string | null;
	lastHash: string | null;
	failure: {
		sequence: string;
		reason: string;
		expectedHash?: string;
		actualHash?: string;
	} | null;
}

function getAuditHashSecret(): string {
	const secret =
		process.env.AUDIT_LOG_HMAC_SECRET ?? process.env.SYSTEM_CONFIG_SECRET;

	if (!secret) {
		throw new Error(
			"AUDIT_LOG_HMAC_SECRET or SYSTEM_CONFIG_SECRET is required",
		);
	}

	return secret;
}

function getAuditHashKeyId(): string {
	return process.env.AUDIT_LOG_HMAC_KEY_ID ?? "default:v1";
}

function compareStringsAlphabetically(a: string, b: string): number {
	return a.localeCompare(b, "en", { sensitivity: "variant" });
}

function normalizeJson(value: Prisma.JsonValue | AuditMetadata | undefined) {
	if (value === undefined) return null;
	return value;
}

function stableStringify(value: unknown): string {
	if (value === null) return "null";
	if (typeof value === "string") return JSON.stringify(value);
	if (typeof value === "number" || typeof value === "boolean") {
		return JSON.stringify(value);
	}
	if (typeof value === "bigint") return JSON.stringify(value.toString());
	if (value instanceof Date) return JSON.stringify(value.toISOString());
	if (Array.isArray(value)) {
		return `[${value.map((item) => stableStringify(item)).join(",")}]`;
	}
	if (typeof value === "object") {
		const record = value as Record<string, unknown>;
		const keys = Object.keys(record).sort(compareStringsAlphabetically);
		return `{${keys
			.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
			.join(",")}}`;
	}
	return JSON.stringify(null);
}

function canonicalByteLength(value: unknown): number {
	return Buffer.byteLength(stableStringify(value), "utf8");
}

function normalizeAuditMetadata(
	value: Prisma.JsonValue | AuditMetadata | undefined,
): AuditMetadata | null {
	const metadata = normalizeJson(value);
	if (metadata === null) return null;

	const bytes = canonicalByteLength(metadata);
	if (bytes <= MAX_METADATA_CANONICAL_BYTES) {
		return metadata as AuditMetadata;
	}

	return {
		truncated: true,
		reason: "AUDIT_METADATA_TOO_LARGE",
		originalCanonicalBytes: bytes,
		maxCanonicalBytes: MAX_METADATA_CANONICAL_BYTES,
	};
}

function canonicalAuditPayload(input: {
	id: string;
	sequence: bigint;
	action: string;
	actorType: AuditActorType;
	actorUserId: string | null;
	targetType: string | null;
	targetId: string | null;
	classId: string | null;
	metadata: Prisma.JsonValue | AuditMetadata | null;
	ipAddress: string | null;
	userAgent: string | null;
	requestId: string | null;
	prevHash: string | null;
	hashAlgorithm: string;
	hashKeyId: string;
	createdAt: Date | string;
}): string {
	return stableStringify({
		id: input.id,
		sequence: input.sequence.toString(),
		action: input.action,
		actorType: input.actorType,
		actorUserId: input.actorUserId,
		targetType: input.targetType,
		targetId: input.targetId,
		classId: input.classId,
		metadata: normalizeJson(input.metadata),
		ipAddress: input.ipAddress,
		userAgent: input.userAgent,
		requestId: input.requestId,
		prevHash: input.prevHash,
		hashAlgorithm: input.hashAlgorithm,
		hashKeyId: input.hashKeyId,
		createdAt:
			input.createdAt instanceof Date
				? input.createdAt.toISOString()
				: new Date(input.createdAt).toISOString(),
	});
}

export function computeAuditEntryHash(input: {
	id: string;
	sequence: bigint;
	action: string;
	actorType: AuditActorType;
	actorUserId: string | null;
	targetType: string | null;
	targetId: string | null;
	classId: string | null;
	metadata: Prisma.JsonValue | AuditMetadata | null;
	ipAddress: string | null;
	userAgent: string | null;
	requestId: string | null;
	prevHash: string | null;
	hashAlgorithm: string;
	hashKeyId: string;
	createdAt: Date | string;
}): string {
	return createHmac(HMAC_DIGEST, getAuditHashSecret())
		.update(canonicalAuditPayload(input))
		.digest("hex");
}

function safeHashEqual(a: string, b: string): boolean {
	const left = Buffer.from(a, "hex");
	const right = Buffer.from(b, "hex");
	return left.length === right.length && timingSafeEqual(left, right);
}

function toAuditLogItem(row: {
	id: string;
	sequence: bigint;
	action: string;
	actorType: AuditActorType;
	actorUserId: string | null;
	targetType: string | null;
	targetId: string | null;
	classId: string | null;
	metadata: Prisma.JsonValue | null;
	ipAddress: string | null;
	userAgent: string | null;
	requestId: string | null;
	prevHash: string | null;
	entryHash: string;
	hashAlgorithm: string;
	hashKeyId: string;
	createdAt: Date;
}): AuditLogItem {
	return {
		...row,
		sequence: row.sequence.toString(),
		createdAt: row.createdAt.toISOString(),
	};
}

export async function writeAuditLog(input: RecordAuditLogInput) {
	const hashKeyId = getAuditHashKeyId();
	const createdAt = new Date();
	const id = randomUUID();

	return prisma.$transaction(async (tx) => {
		await tx.$executeRaw`SELECT pg_advisory_xact_lock(20260517, 1)`;

		const previous = await tx.auditLog.findFirst({
			orderBy: { sequence: "desc" },
			select: { entryHash: true },
		});

		const [{ sequence }] = await tx.$queryRawUnsafe<
			Array<{ sequence: bigint }>
		>("SELECT nextval('audit_logs_sequence_seq')::bigint AS sequence");

		const data = {
			id,
			sequence,
			action: input.action,
			actorType: input.actor.type,
			actorUserId: input.actor.userId ?? null,
			targetType: input.targetType ?? null,
			targetId: input.targetId ?? null,
			classId: input.classId ?? null,
			metadata: normalizeAuditMetadata(input.metadata),
			ipAddress: input.ipAddress?.slice(0, 45) ?? null,
			userAgent: input.userAgent?.slice(0, 512) ?? null,
			requestId: input.requestId?.slice(0, 128) ?? null,
			prevHash: previous?.entryHash ?? null,
			hashAlgorithm: HASH_ALGORITHM,
			hashKeyId,
			createdAt,
		};

		const entryHash = computeAuditEntryHash(data);

		return tx.auditLog.create({
			data: {
				...data,
				metadata: data.metadata === null ? Prisma.JsonNull : data.metadata,
				entryHash,
			},
		});
	});
}

export async function recordAuditLog(
	input: RecordAuditLogInput,
): Promise<void> {
	try {
		await writeAuditLog(input);
	} catch (err) {
		rootLogger.error({ err, action: input.action }, "audit_log_write_failed");
	}
}

export async function listAuditLogs(query: ListAuditLogsQuery) {
	const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
	const where: Prisma.AuditLogWhereInput = {
		...(query.action ? { action: query.action } : {}),
		...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
		...(query.targetType ? { targetType: query.targetType } : {}),
		...(query.targetId ? { targetId: query.targetId } : {}),
		...(query.classId ? { classId: query.classId } : {}),
		...(query.from || query.to
			? {
					createdAt: {
						...(query.from ? { gte: query.from } : {}),
						...(query.to ? { lte: query.to } : {}),
					},
				}
			: {}),
	};

	const rows = await prisma.auditLog.findMany({
		where: {
			...where,
			...(query.cursor
				? {
						sequence: {
							lt: BigInt(query.cursor),
						},
					}
				: {}),
		},
		orderBy: { sequence: "desc" },
		take: limit + 1,
	});

	const items = rows.slice(0, limit).map(toAuditLogItem);
	const next = rows.length > limit ? rows[limit] : null;

	return {
		items,
		nextCursor: next?.sequence.toString() ?? null,
	};
}

export async function verifyAuditLogs(
	query: VerifyAuditLogsQuery = {},
): Promise<AuditVerifyResult> {
	const rows = await prisma.auditLog.findMany({
		where:
			query.from || query.to
				? {
						createdAt: {
							...(query.from ? { gte: query.from } : {}),
							...(query.to ? { lte: query.to } : {}),
						},
					}
				: undefined,
		orderBy: { sequence: "asc" },
	});

	let previousHash: string | null = null;
	let checkedCount = 0;

	for (const row of rows) {
		if (!query.from && checkedCount === 0 && row.prevHash !== null) {
			return {
				valid: false,
				checkedCount,
				lastSequence: null,
				lastHash: null,
				failure: {
					sequence: row.sequence.toString(),
					reason: "FIRST_PREV_HASH_NOT_NULL",
				},
			};
		}

		if (checkedCount > 0 && row.prevHash !== previousHash) {
			return {
				valid: false,
				checkedCount,
				lastSequence: row.sequence.toString(),
				lastHash: previousHash,
				failure: {
					sequence: row.sequence.toString(),
					reason: "PREV_HASH_MISMATCH",
					expectedHash: previousHash ?? undefined,
					actualHash: row.prevHash ?? undefined,
				},
			};
		}

		const expectedHash = computeAuditEntryHash({
			id: row.id,
			sequence: row.sequence,
			action: row.action,
			actorType: row.actorType,
			actorUserId: row.actorUserId,
			targetType: row.targetType,
			targetId: row.targetId,
			classId: row.classId,
			metadata: row.metadata,
			ipAddress: row.ipAddress,
			userAgent: row.userAgent,
			requestId: row.requestId,
			prevHash: row.prevHash,
			hashAlgorithm: row.hashAlgorithm,
			hashKeyId: row.hashKeyId,
			createdAt: row.createdAt,
		});

		if (!safeHashEqual(expectedHash, row.entryHash)) {
			return {
				valid: false,
				checkedCount,
				lastSequence: row.sequence.toString(),
				lastHash: previousHash,
				failure: {
					sequence: row.sequence.toString(),
					reason: "ENTRY_HASH_MISMATCH",
					expectedHash,
					actualHash: row.entryHash,
				},
			};
		}

		checkedCount += 1;
		previousHash = row.entryHash;
	}

	const last = rows.at(-1);
	return {
		valid: true,
		checkedCount,
		lastSequence: last?.sequence.toString() ?? null,
		lastHash: previousHash,
		failure: null,
	};
}
