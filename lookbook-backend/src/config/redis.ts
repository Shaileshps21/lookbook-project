import Redis from "ioredis";
import { env } from "./env";

// Cache is a pure optimization — the app must work identically (just slower)
// if Redis is unreachable, so every failure here is caught and logged, never
// thrown into the request path.
export const redis = env.redisUrl
  ? new Redis(env.redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true })
  : null;

let hasWarnedUnavailable = false;
const warnUnavailable = (err: unknown) => {
  if (hasWarnedUnavailable) return;
  hasWarnedUnavailable = true;
  // eslint-disable-next-line no-console
  console.warn("[redis] Unavailable, homepage caching disabled:", err);
};

if (redis) {
  redis.on("error", warnUnavailable);
  redis.connect().catch(warnUnavailable);
}

export const getCache = async <T>(key: string): Promise<T | null> => {
  if (!redis || redis.status !== "ready") return null;
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export const setCache = async (key: string, value: unknown, ttlSeconds: number): Promise<void> => {
  if (!redis || redis.status !== "ready") return;
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // Best-effort — a failed cache write shouldn't affect the response already sent.
  }
};

export const invalidateCache = async (key: string): Promise<void> => {
  if (!redis || redis.status !== "ready") return;
  try {
    await redis.del(key);
  } catch {
    // Best-effort — a stale cache entry just expires naturally via its TTL.
  }
};
