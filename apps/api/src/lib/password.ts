import { compare, hash } from "@node-rs/bcrypt";

export const BCRYPT_COST = 10;

export async function hashPassword(password: string): Promise<string> {
	return hash(password, BCRYPT_COST);
}

export async function verifyPassword(
	password: string,
	passwordHash: string,
): Promise<boolean> {
	return compare(password, passwordHash);
}
