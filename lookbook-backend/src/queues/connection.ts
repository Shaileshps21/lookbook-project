import Redis from "ioredis";
import type { EventEmitter } from "node:events";
import { env } from "../config/env";

// Managed Redis providers (e.g. Redis Cloud) lock `maxmemory-policy` — trying
// `CONFIG SET maxmemory-policy noeviction` returns "ERR Unsupported CONFIG
// parameter" — so the eviction policy can't be changed from this app. BullMQ
// still works fine under volatile-lru, which means its `IMPORTANT! Eviction
// policy is ...` startup warning is pure noise. Filter just that one known
// message; every other console.warn passes through untouched.
const IGNORED_WARN_MARKER = "IMPORTANT! Eviction policy is";
// eslint-disable-next-line no-console
const originalWarn = console.warn;
// eslint-disable-next-line no-console
console.warn = (...args: unknown[]) => {
  if (args.some((a) => typeof a === "string" && a.includes(IGNORED_WARN_MARKER))) return;
  originalWarn(...args);
};

// Queues are a pure background enhancement: if Redis isn't configured, we
// simply never start them, and the app behaves identically minus the
// automated reminder emails / cached leaderboard refresh.

// Each BullMQ Queue AND each Worker gets its OWN ioredis connection. Workers
// issue blocking commands (BRPOPLPUSH) that tie up the socket for the whole
// poll, so sharing one connection across several Queues + Workers collides
// those commands and lets a single dropped TCP connection (managed providers
// like Redis Cloud close idle sockets — ioredis defaults keepAlive to 0)
// kill every queue at once, taking job locks down with it ("Missing lock for
// job N. moveToFinished"). One connection per Queue/Worker keeps them
// isolated so a reset in one can't break the others.

// Config follows BullMQ's recommended ioredis connection: maxRetriesPerRequest
// must be null for the blocking commands Workers use, keepAlive stops managed
// providers from resetting idle sockets, and retryStrategy gives bounded
// backoff on reconnect. The offline queue stays at its ioredis default so a
// command issued mid-reconnect is buffered and sent once the socket is back,
// rather than throwing "Stream isn't writeable" errors on every poll while the
// connection cycles.
export const createQueueConnection = (): Redis =>
  new Redis(env.redisUrl, {
    maxRetriesPerRequest: null,
    keepAlive: 60_000,
    connectTimeout: 10_000,
    retryStrategy: (times) => Math.min(times * 1_000, 30_000),
  });

export const createWorkerConnection = (): Redis => createQueueConnection();

export const queuesEnabled = Boolean(env.redisUrl);

/** Rate-limits logging of transient connection errors so a flaky network
 * window (DNS failures, timeouts, resets — all normal when talking to a
 * managed provider and all already handled by ioredis's reconnect loop)
 * doesn't dump one full stack trace per reconnect attempt. Non-connection
 * errors (e.g. job-processing failures) are always logged immediately and in
 * full — nothing is ever silently dropped, only batched. */
export const attachQueueErrorHandler = (emitter: EventEmitter, label: string): void => {
  let windowStart = 0;
  let suppressed = 0;

  emitter.on("error", (err: Error) => {
    const message = err?.message ?? String(err);
    const isConnectionError = /(ECONNRESET|ENOTFOUND|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|Stream isn't writeable|Connection is closed)/i.test(message);

    if (isConnectionError) {
      const now = Date.now();
      if (now - windowStart < 60_000) {
        suppressed += 1;
        return;
      }
      windowStart = now;
      // eslint-disable-next-line no-console
      console.error(`[queues:${label}] Redis connection issue (auto-retrying):`, err);
      if (suppressed > 0) {
        // eslint-disable-next-line no-console
        console.error(`[queues:${label}] Suppressed ${suppressed} similar transient connection error(s) in the last 60s.`);
        suppressed = 0;
      }
      return;
    }

    // eslint-disable-next-line no-console
    console.error(`[queues:${label}]`, err);
  });
};
