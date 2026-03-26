import jwt from "jsonwebtoken";

import { AppError } from "./errors.js";

export interface JwtPayload {
	sub: string;
	email: string;
}

const EXPIRES_IN = "7d";

export function signUserJwt(payload: JwtPayload, secret: string): string {
	return jwt.sign(payload, secret, { expiresIn: EXPIRES_IN });
}

export function verifyUserJwt(token: string, secret: string): JwtPayload {
	try {
		const decoded = jwt.verify(token, secret);

		if (
			typeof decoded !== "object" ||
			decoded === null ||
			typeof decoded.sub !== "string" ||
			typeof decoded.email !== "string"
		) {
			throw new AppError(401, "INVALID_TOKEN", "Invalid token payload");
		}

		return { sub: decoded.sub, email: decoded.email };
	} catch {
		throw new AppError(401, "INVALID_TOKEN", "Invalid or expired token");
	}
}
