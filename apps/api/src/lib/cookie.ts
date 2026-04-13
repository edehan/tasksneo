import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

export const SESSION_COOKIE_NAME = "tfses_session";

const UNTRUSTED_MAX_AGE = 7 * 24 * 60 * 60; // 7 days
const TRUSTED_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

function cookieBaseOptions() {
	return {
		httpOnly: true,
		secure: process.env.COOKIE_SECURE === "true",
		sameSite: "Lax" as const,
		path: "/",
		...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
	};
}

export function setSessionCookie(
	c: Context,
	token: string,
	isTrusted: boolean,
): void {
	setCookie(c, SESSION_COOKIE_NAME, token, {
		...cookieBaseOptions(),
		maxAge: isTrusted ? TRUSTED_MAX_AGE : UNTRUSTED_MAX_AGE,
	});
}

export function clearSessionCookie(c: Context): void {
	deleteCookie(c, SESSION_COOKIE_NAME, cookieBaseOptions());
}

export function readSessionCookie(c: Context): string | undefined {
	return getCookie(c, SESSION_COOKIE_NAME);
}
