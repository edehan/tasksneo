import type { Context } from "hono";
import { setCookie } from "hono/cookie";

export const SESSION_COOKIE_NAME = "tfses_session";

const UNTRUSTED_MAX_AGE = 7 * 24 * 60 * 60; // 7 days
const TRUSTED_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export function setSessionCookie(
	c: Context,
	token: string,
	isTrusted: boolean,
): void {
	const isSecure = process.env.COOKIE_SECURE === "true";
	setCookie(c, SESSION_COOKIE_NAME, token, {
		httpOnly: true,
		secure: isSecure,
		sameSite: "Lax",
		path: "/",
		maxAge: isTrusted ? TRUSTED_MAX_AGE : UNTRUSTED_MAX_AGE,
		...(process.env.COOKIE_DOMAIN
			? { domain: process.env.COOKIE_DOMAIN }
			: {}),
	});
}

export function clearSessionCookie(c: Context): void {
	const isSecure = process.env.COOKIE_SECURE === "true";
	setCookie(c, SESSION_COOKIE_NAME, "", {
		httpOnly: true,
		secure: isSecure,
		sameSite: "Lax",
		path: "/",
		maxAge: 0,
		...(process.env.COOKIE_DOMAIN
			? { domain: process.env.COOKIE_DOMAIN }
			: {}),
	});
}
