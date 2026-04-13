const envOrigins = (process.env.CORS_ORIGINS ?? "")
	.split(",")
	.map((s) => s.trim())
	.filter(Boolean);

export const ALLOWED_WEB_ORIGINS = new Set([
	"http://localhost:3000",
	"http://127.0.0.1:3000",
	"http://localhost:35540",
	"http://127.0.0.1:35540",
	...envOrigins,
]);

export function isAllowedWebOrigin(origin: string | null | undefined): boolean {
	return Boolean(origin && ALLOWED_WEB_ORIGINS.has(origin));
}
