import { AppError } from "./errors.js";

export interface AppEnv {
	listenHost: string;
	listenPort: number;
	databaseUrl: string;
	adminToken: string;
	systemConfigSecret: string;
	jwtSecret: string;
	redisUrl: string;
	s3Endpoint: string;
	s3Port: number | undefined;
	s3AccessKey: string;
	s3SecretKey: string;
	s3Bucket: string;
	s3UseSSL: boolean;
	s3Region: string;
	s3PathStyle: boolean;
	captchaEnabled: boolean;
	captchaVerifyUrlOverride: string | null;
	captchaSecret: string | null;
	captchaProofTtlSeconds: number;
	captchaProofSecret: string;
}

const DEFAULT_LISTEN_ADDR = "0.0.0.0:3001";

function parseListenAddr(listenAddr: string): { host: string; port: number } {
	const [host, portRaw] = listenAddr.split(":");
	const port = Number(portRaw);

	if (!host || Number.isNaN(port) || port <= 0) {
		throw new AppError(500, "INVALID_CONFIG", "LISTEN_ADDR must be host:port");
	}

	return { host, port };
}

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new AppError(
			500,
			"MISSING_CONFIG",
			`Missing environment variable: ${name}`,
		);
	}

	return value;
}

function requireEnvEither(primary: string, fallback: string): string {
	const value = process.env[primary] ?? process.env[fallback];
	if (!value) {
		throw new AppError(
			500,
			"MISSING_CONFIG",
			`Missing environment variable: ${primary} (or ${fallback})`,
		);
	}

	return value;
}

function optionalEnv(primary: string, fallback?: string): string | undefined {
	return process.env[primary] ?? (fallback ? process.env[fallback] : undefined);
}

function optionalEnvPort(
	primary: string,
	fallback: string,
): number | undefined {
	const raw = process.env[primary] ?? process.env[fallback];
	if (!raw) return undefined;
	const num = Number(raw);
	return Number.isNaN(num) ? undefined : num;
}

export function loadEnv(): AppEnv {
	const { host, port } = parseListenAddr(
		process.env.LISTEN_ADDR ?? DEFAULT_LISTEN_ADDR,
	);

	const s3Port = optionalEnvPort("S3_PORT", "MINIO_PORT");
	const s3UseSSLRaw = process.env.S3_USE_SSL;
	// Default: true for cloud (no port or port 443), false for local MinIO (port 9000 etc.)
	const s3UseSSL =
		s3UseSSLRaw != null
			? s3UseSSLRaw === "true"
			: s3Port == null || s3Port === 443;
	const captchaEnabled = (process.env.CAPTCHA_ENABLED ?? "false") === "true";
	const captchaVerifyUrlOverride = optionalEnv("CAPTCHA_VERIFY_URL") ?? null;
	const captchaSecret = optionalEnv("CAPTCHA_SECRET") ?? null;
	const captchaProofTtlRaw = process.env.CAPTCHA_PROOF_TTL_SECONDS ?? "300";
	const captchaProofTtlSeconds = Number(captchaProofTtlRaw);

	if (
		!Number.isFinite(captchaProofTtlSeconds) ||
		captchaProofTtlSeconds <= 0
	) {
		throw new AppError(
			500,
			"INVALID_CONFIG",
			"CAPTCHA_PROOF_TTL_SECONDS must be a positive integer",
		);
	}

	if (captchaEnabled && !captchaSecret) {
		throw new AppError(
			500,
			"MISSING_CONFIG",
			"CAPTCHA_ENABLED=true requires CAPTCHA_SECRET",
		);
	}

	return {
		listenHost: host,
		listenPort: port,
		databaseUrl: requireEnv("DATABASE_URL"),
		adminToken: requireEnv("ADMIN_TOKEN"),
		systemConfigSecret: requireEnv("SYSTEM_CONFIG_SECRET"),
		jwtSecret: requireEnv("JWT_SECRET"),
		redisUrl: requireEnv("REDIS_URL"),
		s3Endpoint: requireEnvEither("S3_ENDPOINT", "MINIO_ENDPOINT"),
		s3Port,
		s3AccessKey: requireEnvEither("S3_ACCESS_KEY", "MINIO_ACCESS_KEY"),
		s3SecretKey: requireEnvEither("S3_SECRET_KEY", "MINIO_SECRET_KEY"),
		s3Bucket: requireEnvEither("S3_BUCKET", "MINIO_BUCKET"),
		s3UseSSL,
			s3Region: process.env.S3_REGION ?? "auto",
			s3PathStyle: (process.env.S3_PATH_STYLE ?? "true") === "true",
			captchaEnabled,
			captchaVerifyUrlOverride,
			captchaSecret,
			captchaProofTtlSeconds: Math.floor(captchaProofTtlSeconds),
			captchaProofSecret: process.env.CAPTCHA_PROOF_SECRET ?? requireEnv("JWT_SECRET"),
	};
}

export function getJwtSecret(): string {
	return requireEnv("JWT_SECRET");
}

export function getAdminToken(): string {
	return requireEnv("ADMIN_TOKEN");
}

export function getSystemConfigSecret(): string {
	return requireEnv("SYSTEM_CONFIG_SECRET");
}
