import { getConfigValue } from "../services/system-config.service.js";
import { AppError } from "./errors.js";

interface SmtpConfig {
	host: string;
	port: number;
	user: string;
	password: string;
	from: string;
	fromName: string;
	appTitle: string;
}

interface CyberPanelConfig {
	apiKey: string;
	from: string;
	appTitle: string;
}

const DEFAULT_APP_TITLE = "TaskNeo";
const CYBERPANEL_API_URL = "https://platform.cyberpersons.com/email/v1/send";

async function loadSmtpConfig(): Promise<SmtpConfig> {
	const host = await getConfigValue("smtp.host");
	const portRaw = await getConfigValue("smtp.port");
	const user = await getConfigValue("smtp.user");
	const password = await getConfigValue("smtp.password");
	const from = await getConfigValue("smtp.from");
	const fromName = await getConfigValue("smtp.from_name");
	const appTitle = await getConfigValue("app.title");

	if (!host || !portRaw || !user || !password || !from) {
		throw new AppError(400, "SMTP_NOT_CONFIGURED", "SMTP config is incomplete");
	}

	const port = Number(portRaw);

	if (Number.isNaN(port) || port <= 0) {
		throw new AppError(400, "SMTP_NOT_CONFIGURED", "SMTP port is invalid");
	}

	return {
		host,
		port,
		user,
		password,
		from,
		fromName: fromName?.trim() ?? "",
		appTitle: appTitle?.trim() ?? "",
	};
}

async function loadCyberPanelConfig(): Promise<CyberPanelConfig> {
	const apiKey = await getConfigValue("cyberpanel.api_key");
	const from = await getConfigValue("cyberpanel.from");
	const appTitle = await getConfigValue("app.title");

	if (!apiKey || !from) {
		throw new AppError(
			400,
			"CYBERPANEL_NOT_CONFIGURED",
			"CyberPanel config is incomplete",
		);
	}

	return {
		apiKey,
		from: from.trim(),
		appTitle: appTitle?.trim() ?? "",
	};
}

function escapeDisplayName(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function hasDisplayName(from: string): boolean {
	return /<[^>]+>/.test(from);
}

function buildFromHeader(config: SmtpConfig): string {
	const from = config.from.trim();

	if (hasDisplayName(from)) {
		return from;
	}

	const displayName = config.fromName || config.appTitle || DEFAULT_APP_TITLE;
	return `"${escapeDisplayName(displayName)}" <${from}>`;
}

async function sendEmailViaSmtp(
	to: string,
	subject: string,
	text: string,
	html?: string,
) {
	const config = await loadSmtpConfig();
	const nodemailer = await import("nodemailer");

	const transporter = nodemailer.createTransport({
		host: config.host,
		port: config.port,
		secure: config.port === 465,
		requireTLS: config.port !== 465,
		auth: {
			user: config.user,
			pass: config.password,
		},
	});

	try {
		await transporter.sendMail({
			from: buildFromHeader(config),
			to,
			subject,
			text,
			...(html ? { html } : {}),
		});
	} catch (error) {
		const code =
			typeof error === "object" && error !== null && "code" in error
				? error.code
				: undefined;

		if (code === "EAUTH") {
			throw new AppError(400, "SMTP_AUTH_FAILED", "SMTP authentication failed");
		}

		if (
			code === "ESOCKET" ||
			code === "ECONNECTION" ||
			code === "ETIMEDOUT" ||
			code === "EDNS" ||
			code === "ECONNREFUSED"
		) {
			throw new AppError(503, "SMTP_UNAVAILABLE", "SMTP server is unavailable");
		}

		throw error;
	}
}

async function sendEmailViaCyberPanel(
	to: string,
	subject: string,
	text: string,
	html?: string,
) {
	const config = await loadCyberPanelConfig();

	const body: Record<string, unknown> = {
		from: config.from,
		to,
		subject,
		html: html ?? text,
	};

	if (html && text) {
		body.text = text;
	}

	const response = await fetch(CYBERPANEL_API_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${config.apiKey}`,
		},
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		let errorCode = "CYBERPANEL_SEND_FAILED";
		let errorMessage = `CyberPanel request failed with status ${response.status}`;

		try {
			const data = (await response.json()) as {
				success?: boolean;
				error?: { code?: string; message?: string };
			};
			if (data.error?.code) {
				errorCode = data.error.code;
			}
			if (data.error?.message) {
				errorMessage = data.error.message;
			}
		} catch {
			// ignore parse error
		}

		if (response.status === 429) {
			throw new AppError(429, errorCode, errorMessage);
		}

		throw new AppError(
			response.status >= 500 ? 503 : 400,
			errorCode,
			errorMessage,
		);
	}
}

export async function sendEmail(
	to: string,
	subject: string,
	text: string,
	html?: string,
) {
	const provider = (await getConfigValue("email.provider"))?.trim() || "smtp";

	if (provider === "cyberpanel") {
		await sendEmailViaCyberPanel(to, subject, text, html);
	} else {
		await sendEmailViaSmtp(to, subject, text, html);
	}
}
