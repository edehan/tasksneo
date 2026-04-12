import { customAlphabet } from "nanoid";

import { AppError } from "./errors.js";

export const PUBLIC_ID_LENGTH = 8;
export const PUBLIC_ID_ALPHABET =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const UUID_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_ID_REGEX = new RegExp(
	`^[A-Za-z0-9]{${PUBLIC_ID_LENGTH.toString()}}$`,
);
const createPublicId = customAlphabet(PUBLIC_ID_ALPHABET, PUBLIC_ID_LENGTH);

export type ResourceIdKind = "uuid" | "publicId";

export function generatePublicId(): string {
	return createPublicId();
}

export function isUuid(value: string): boolean {
	return UUID_REGEX.test(value);
}

export function isPublicId(value: string): boolean {
	return PUBLIC_ID_REGEX.test(value);
}

export function parseResourceId(
	value: string,
	fieldName = "id",
): ResourceIdKind {
	if (isUuid(value)) {
		return "uuid";
	}

	if (isPublicId(value)) {
		return "publicId";
	}

	throw new AppError(
		400,
		"INVALID_RESOURCE_ID",
		`${fieldName} must be a UUID or ${PUBLIC_ID_LENGTH.toString()}-character public id`,
	);
}

export async function createUniquePublicId(
	exists: (publicId: string) => Promise<boolean>,
): Promise<string> {
	for (let attempt = 0; attempt < 8; attempt += 1) {
		const publicId = generatePublicId();
		if (!(await exists(publicId))) {
			return publicId;
		}
	}

	throw new AppError(
		500,
		"PUBLIC_ID_GENERATION_FAILED",
		"Failed to generate public id",
	);
}

export function isUniqueConstraintError(
	error: unknown,
	fields: string[],
): boolean {
	if (
		typeof error !== "object" ||
		error === null ||
		!("code" in error) ||
		error.code !== "P2002"
	) {
		return false;
	}

	const meta = "meta" in error ? error.meta : null;
	const target = meta && typeof meta === "object" && "target" in meta ? meta.target : null;
	const targets = Array.isArray(target)
		? target.filter((value): value is string => typeof value === "string")
		: typeof target === "string"
			? [target]
			: [];

	if (targets.length === 0) {
		return false;
	}

	return targets.some((targetValue) =>
		fields.some(
			(field) =>
				targetValue === field ||
				targetValue.endsWith(`.${field}`) ||
				targetValue.includes(field),
		),
	);
}
