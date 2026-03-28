import { Redis } from "ioredis";

import { loadEnv } from "./env.js";

let redis: Redis | null = null;

export function getRedisClient() {
	if (redis) {
		return redis;
	}

	const env = loadEnv();
	const client = new Redis(env.redisUrl, {
		maxRetriesPerRequest: 1,
		enableReadyCheck: false,
	});
	redis = client;

	return client;
}
