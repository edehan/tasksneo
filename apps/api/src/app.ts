import { prisma } from "@taskflow/db";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { getCacheStats } from "./lib/cache.js";
import { AppError } from "./lib/errors.js";
import { getRedisClient } from "./lib/redis.js";
import { errorHandler } from "./middleware/error.js";
import { requestLogMiddleware } from "./middleware/request-log.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { classesRouter } from "./routes/classes.js";
import { filesRouter } from "./routes/files.js";
import { schoolsRouter } from "./routes/schools.js";
import { sttRouter } from "./routes/stt.js";
import { submissionsRouter } from "./routes/submissions.js";
import { tasksRouter } from "./routes/tasks.js";
import { usersRouter } from "./routes/users.js";
import { startAnnouncementWorker } from "./services/announcement.service.js";
import { startNotificationWorker } from "./services/notification.service.js";
import { startSessionCleanupWorker } from "./services/session.service.js";

import type { AppVariables } from "./types/context.js";

const envOrigins = (process.env.CORS_ORIGINS ?? "")
	.split(",")
	.map((s) => s.trim())
	.filter(Boolean);

const ALLOWED_WEB_ORIGINS = new Set([
	"http://localhost:3000",
	"http://127.0.0.1:3000",
	"http://localhost:35540",
	"http://127.0.0.1:35540",
	...envOrigins,
]);

export function createApp(options?: { startWorker?: boolean }) {
	const app = new Hono<{ Variables: AppVariables }>();

	app.onError(errorHandler);
	app.use("*", requestLogMiddleware);
	app.use(
		"*",
		cors({
			origin: (origin) => {
				if (!origin || ALLOWED_WEB_ORIGINS.has(origin)) {
					return origin;
				}

				return "";
			},
			allowHeaders: ["Content-Type", "Authorization"],
			allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		}),
	);

	app.get("/health", (c) => c.json({ status: "ok" }, 200));
	app.get("/health/cache", (c) => c.json(getCacheStats(), 200));
	app.get("/health/ready", async (c) => {
		const checks: Record<string, "ok" | string> = {};
		let healthy = true;

		try {
			await prisma.$queryRaw`SELECT 1`;
			checks.postgres = "ok";
		} catch (err) {
			healthy = false;
			checks.postgres =
				err instanceof Error ? err.message : "unknown postgres error";
		}

		try {
			const pong = await getRedisClient().ping();
			checks.redis = pong === "PONG" ? "ok" : `unexpected: ${pong}`;
			if (checks.redis !== "ok") healthy = false;
		} catch (err) {
			healthy = false;
			checks.redis = err instanceof Error ? err.message : "unknown redis error";
		}

		if (!healthy) {
			throw new AppError(
				503,
				"DEP_UNHEALTHY",
				`Dependency unhealthy: ${JSON.stringify(checks)}`,
			);
		}

		return c.json({ status: "ok", checks }, 200);
	});
	app.route("/auth", authRouter);
	app.route("/users", usersRouter);
	app.route("/schools", schoolsRouter);
	app.route("/classes", classesRouter);
	app.route("/tasks", tasksRouter);
	app.route("/stt", sttRouter);
	app.route("/submissions", submissionsRouter);
	app.route("/files", filesRouter);
	app.route("/admin", adminRouter);

	if (options?.startWorker) {
		startNotificationWorker();
		startAnnouncementWorker();
		void startSessionCleanupWorker().catch((err) => {
			console.error("[session-cleanup] failed to start worker", err);
		});
	}

	return app;
}

export const app = createApp({
	startWorker: process.env.NOTIFICATION_WORKER_ENABLED === "true",
});
