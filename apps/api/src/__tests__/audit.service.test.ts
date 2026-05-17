import { AuditActorType, prisma } from "@taskflow/db";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
	computeAuditEntryHash,
	verifyAuditLogs,
	writeAuditLog,
} from "../services/audit.service.js";
import { resetDatabase } from "./test-helpers.js";

const BASE_HASH_INPUT = {
	id: "00000000-0000-0000-0000-000000000001",
	sequence: 1n,
	action: "AUTH_LOGIN",
	actorType: AuditActorType.USER,
	actorUserId: "00000000-0000-0000-0000-000000000002",
	targetType: "USER",
	targetId: "00000000-0000-0000-0000-000000000002",
	classId: null,
	metadata: { trusted: true },
	ipAddress: "127.0.0.1",
	userAgent: "vitest",
	requestId: "req-1",
	prevHash: null,
	hashAlgorithm: "HMAC-SHA256",
	hashKeyId: "default:v1",
	createdAt: new Date("2026-05-17T00:00:00.000Z"),
};

describe("audit service", () => {
	beforeEach(async () => {
		await resetDatabase();
	});

	afterAll(async () => {
		await prisma.$disconnect();
	});

	it("computes stable HMAC hashes and detects payload changes", () => {
		const first = computeAuditEntryHash(BASE_HASH_INPUT);
		const second = computeAuditEntryHash({
			...BASE_HASH_INPUT,
			metadata: { trusted: true },
		});
		const changed = computeAuditEntryHash({
			...BASE_HASH_INPUT,
			metadata: { trusted: false },
		});

		expect(second).toBe(first);
		expect(changed).not.toBe(first);
	});

	it("serializes concurrent writes into a valid global hash chain", async () => {
		await Promise.all(
			Array.from({ length: 10 }, (_, index) =>
				writeAuditLog({
					action: "AUTH_LOGIN",
					actor: {
						type: AuditActorType.USER,
						userId: `00000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
					},
					targetType: "USER",
					targetId: `00000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
					metadata: { index },
				}),
			),
		);

		const rows = await prisma.auditLog.findMany({
			orderBy: { sequence: "asc" },
		});

		expect(rows).toHaveLength(10);
		for (let index = 0; index < rows.length; index += 1) {
			expect(rows[index]?.sequence).toBe(BigInt(index + 1));
			expect(rows[index]?.prevHash).toBe(
				index === 0 ? null : rows[index - 1]?.entryHash,
			);
		}

		await expect(verifyAuditLogs()).resolves.toMatchObject({
			valid: true,
			checkedCount: 10,
			failure: null,
		});
	});

	it("reports the first tampered audit entry", async () => {
		await writeAuditLog({
			action: "AUTH_LOGIN",
			actor: {
				type: AuditActorType.USER,
				userId: "00000000-0000-0000-0000-000000000001",
			},
			targetType: "USER",
			targetId: "00000000-0000-0000-0000-000000000001",
			metadata: { trusted: true },
		});
		await writeAuditLog({
			action: "AUTH_LOGOUT",
			actor: {
				type: AuditActorType.USER,
				userId: "00000000-0000-0000-0000-000000000001",
			},
			targetType: "USER",
			targetId: "00000000-0000-0000-0000-000000000001",
		});

		await prisma.$executeRawUnsafe(
			"ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_logs_no_update",
		);
		try {
			await prisma.$executeRawUnsafe(
				"UPDATE audit_logs SET metadata = '{\"trusted\": false}'::jsonb WHERE sequence = 1",
			);
		} finally {
			await prisma.$executeRawUnsafe(
				"ALTER TABLE audit_logs ENABLE TRIGGER trg_audit_logs_no_update",
			);
		}

		await expect(verifyAuditLogs()).resolves.toMatchObject({
			valid: false,
			failure: {
				sequence: "1",
				reason: "ENTRY_HASH_MISMATCH",
			},
		});
	});

	it("prevents ordinary update and delete mutations", async () => {
		const row = await writeAuditLog({
			action: "AUTH_LOGIN",
			actor: {
				type: AuditActorType.USER,
				userId: "00000000-0000-0000-0000-000000000001",
			},
			targetType: "USER",
			targetId: "00000000-0000-0000-0000-000000000001",
		});

		await expect(
			prisma.auditLog.update({
				where: { id: row.id },
				data: { action: "AUTH_LOGOUT" },
			}),
		).rejects.toThrow(/append-only/);

		await expect(
			prisma.auditLog.delete({
				where: { id: row.id },
			}),
		).rejects.toThrow(/append-only/);
	});
});
