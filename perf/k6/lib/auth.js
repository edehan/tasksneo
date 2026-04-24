import http from "k6/http";
import { check } from "k6";
import { apiBaseUrl, origin } from "./config.js";

export function login(user, tags = {}) {
	const response = http.post(
		`${apiBaseUrl}/auth/login`,
		JSON.stringify({
			email: user.email,
			password: user.password,
			trustDevice: false,
		}),
		{
			headers: {
				"Content-Type": "application/json",
				Origin: origin,
			},
			tags: { endpoint: "login", ...tags },
		},
	);

	check(response, {
		"login status 200": (r) => r.status === 200,
		"login has session cookie": (r) => Boolean(r.cookies.tfses_session?.[0]?.value),
	});

	const session = response.cookies.tfses_session?.[0]?.value;
	if (!session) {
		throw new Error(`Login failed for ${user.email}: ${response.status} ${response.body}`);
	}

	return {
		cookieHeader: `tfses_session=${session}`,
		headers: {
			"Content-Type": "application/json",
			Cookie: `tfses_session=${session}`,
			Origin: origin,
		},
	};
}

export function ownerUserFromClass(classInfo) {
	return {
		id: classInfo.ownerId,
		email: classInfo.ownerEmail,
		password: classInfo.ownerPassword || "12345678",
	};
}
