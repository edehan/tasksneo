import nodemailer from "nodemailer";
import { getConfigValue } from "../services/system-config.service.js";
import { AppError } from "./errors.js";

interface SmtpConfig {
	host: string;
	port: number;
	user: string;
	password: string;
	from: string;
}

async function loadSmtpConfig(): Promise<SmtpConfig> {
	const host = await getConfigValue("smtp.host");
	const portRaw = await getConfigValue("smtp.port");
	const user = await getConfigValue("smtp.user");
	const password = await getConfigValue("smtp.password");
	const from = await getConfigValue("smtp.from");

	if (!host || !portRaw || !user || !password || !from) {
		throw new AppError(400, "SMTP_NOT_CONFIGURED", "SMTP config is incomplete");
	}

	const port = Number(portRaw);

	if (Number.isNaN(port) || port <= 0) {
		throw new AppError(400, "SMTP_NOT_CONFIGURED", "SMTP port is invalid");
	}

	return { host, port, user, password, from };
}

export async function sendEmail(
	to: string,
	subject: string,
	text: string,
	html?: string,
) {
	const config = await loadSmtpConfig();

	const transporter = nodemailer.createTransport({
		host: config.host,
		port: config.port,
		secure: config.port === 465,
		auth: {
			user: config.user,
			pass: config.password,
		},
	});

	try {
		await transporter.sendMail({
			from: config.from,
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

		if (code === "ESOCKET" || code === "ECONNECTION" || code === "ETIMEDOUT") {
			throw new AppError(503, "SMTP_UNAVAILABLE", "SMTP server is unavailable");
		}

		throw error;
	}
}
