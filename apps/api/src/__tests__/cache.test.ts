import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock ioredis BEFORE importing cache.ts — we don't want a real connection.
const redisStore = new Map<string, string>();
const scanBatches: Array<[string, string[]]> = [];

const mockClient = {
	get: vi.fn(async (key: string) => redisStore.get(key) ?? null),
	set: vi.fn(async (key: string, value: string) => {
		redisStore.set(key, value);
		return "OK";
	}),
	del: vi.fn(async (...keys: string[]) => {
		let n = 0;
		for (const k of keys) if (redisStore.delete(k)) n += 1;
		return n;
	}),
	scan: vi.fn(async (_cursor: string) => {
		const batch = scanBatches.shift();
		return batch ?? ["0", []];
	}),
	pipeline: vi.fn(() => {
		const ops: Array<["del", string]> = [];
		return {
			del: (k: string) => {
				ops.push(["del", k]);
				return this;
			},
			exec: async () => {
				for (const [, k] of ops) redisStore.delete(k);
				return [];
			},
		};
	}),
};

vi.mock("../lib/redis.js", () => ({
	getRedisClient: () => mockClient,
}));

// Imported AFTER mock so it picks up the mocked client.
const {
	cacheGet,
	cacheSet,
	cacheDel,
	cacheGetOrSet,
	cacheDelPattern,
	getCacheStats,
	resetCacheStats,
} = await import("../lib/cache.js");

describe("cache helper", () => {
	beforeEach(() => {
		redisStore.clear();
		scanBatches.length = 0;
		resetCacheStats();
		for (const fn of Object.values(mockClient))
			if (typeof (fn as { mockClear?: () => void }).mockClear === "function")
				(fn as { mockClear: () => void }).mockClear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("set + get roundtrips JSON values", async () => {
		await cacheSet("k1", { id: "u1", n: 3 }, 60);
		const v = await cacheGet<{ id: string; n: number }>("k1");
		expect(v).toEqual({ id: "u1", n: 3 });
		expect(getCacheStats().hit).toBe(1);
	});

	it("returns null on miss and increments miss counter", async () => {
		const v = await cacheGet("missing");
		expect(v).toBeNull();
		expect(getCacheStats().miss).toBe(1);
		expect(getCacheStats().hit).toBe(0);
	});

	it("cacheDel removes keys", async () => {
		await cacheSet("a", 1, 60);
		await cacheSet("b", 2, 60);
		await cacheDel("a", "b");
		expect(await cacheGet("a")).toBeNull();
		expect(await cacheGet("b")).toBeNull();
	});

	it("cacheDel no-ops when called with empty arg list", async () => {
		await cacheDel();
		expect(mockClient.del).not.toHaveBeenCalled();
	});

	it("cacheGetOrSet loads, caches, and reuses on second call", async () => {
		const loader = vi.fn(async () => ({ role: "OWNER" }));
		const first = await cacheGetOrSet("m1", 300, loader);
		const second = await cacheGetOrSet("m1", 300, loader);
		expect(first).toEqual({ role: "OWNER" });
		expect(second).toEqual({ role: "OWNER" });
		expect(loader).toHaveBeenCalledTimes(1);
		const s = getCacheStats();
		expect(s.miss).toBe(1);
		expect(s.hit).toBe(1);
	});

	it("cacheGetOrSet caches null results via sentinel (no repeat loader)", async () => {
		const loader = vi.fn(async () => null);
		const first = await cacheGetOrSet("m-null", 60, loader);
		const second = await cacheGetOrSet("m-null", 60, loader);
		expect(first).toBeNull();
		expect(second).toBeNull();
		expect(loader).toHaveBeenCalledTimes(1);
	});

	it("cacheGetOrSet falls through to loader on parse failure", async () => {
		redisStore.set("corrupt", "{not-json");
		const loader = vi.fn(async () => ({ ok: true }));
		const v = await cacheGetOrSet("corrupt", 60, loader);
		expect(v).toEqual({ ok: true });
		expect(loader).toHaveBeenCalledTimes(1);
	});

	it("cacheDelPattern walks SCAN cursor and deletes matched keys", async () => {
		redisStore.set("member:c1:u1", '"x"');
		redisStore.set("member:c1:u2", '"y"');
		redisStore.set("member:c2:u1", '"z"');
		scanBatches.push(["1", ["member:c1:u1"]]);
		scanBatches.push(["0", ["member:c1:u2"]]);
		await cacheDelPattern("member:c1:*");
		expect(redisStore.has("member:c1:u1")).toBe(false);
		expect(redisStore.has("member:c1:u2")).toBe(false);
		expect(redisStore.has("member:c2:u1")).toBe(true);
	});

	it("fails open to loader when redis get throws", async () => {
		mockClient.get.mockRejectedValueOnce(new Error("ECONNREFUSED"));
		const loader = vi.fn(async () => ({ fallback: true }));
		const v = await cacheGetOrSet("boom", 60, loader);
		expect(v).toEqual({ fallback: true });
		expect(loader).toHaveBeenCalledTimes(1);
		expect(getCacheStats().error).toBeGreaterThan(0);
	});

	it("fails open on cacheGet when redis throws", async () => {
		mockClient.get.mockRejectedValueOnce(new Error("boom"));
		const v = await cacheGet("x");
		expect(v).toBeNull();
	});
});
