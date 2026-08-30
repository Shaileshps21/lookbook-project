import mongoose from "mongoose";
import { env } from "./env";
import { Book } from "../models/Book";
import { BOOK_VECTOR_INDEX } from "../utils/vectorSearch";

mongoose.set("strictQuery", true);

/**
 * Best-effort: creates the Atlas Vector Search index used by the homepage's
 * recommendation sections if it doesn't exist yet. Not every Atlas tier
 * supports Vector Search, and index creation is async server-side (can take
 * a minute to become queryable) — either way, findSimilarByVector() falls
 * back to an in-process scan, so this never blocks startup.
 */
const ensureBookVectorIndex = async (): Promise<void> => {
  try {
    const existing = await Book.collection.listSearchIndexes(BOOK_VECTOR_INDEX).toArray();
    if (existing.length > 0) return;

    await Book.collection.createSearchIndex({
      name: BOOK_VECTOR_INDEX,
      type: "vectorSearch",
      definition: {
        fields: [
          {
            type: "vector",
            path: "embedding",
            numDimensions: env.gemini.embeddingDimensions,
            similarity: "cosine",
          },
        ],
      },
    });
    // eslint-disable-next-line no-console
    console.log(`[db] Created Atlas Vector Search index "${BOOK_VECTOR_INDEX}" (building in the background).`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      "[db] Could not create/verify Atlas Vector Search index — recommendations will fall back to an in-process similarity scan.",
      error instanceof Error ? error.message : error
    );
  }
};

/**
 * The recurring `MongoServerSelectionError: ... SSL alert number 80` seen
 * throughout this project is Atlas refusing a **non-whitelisted IP** — the
 * driver reports the rejected TLS handshake rather than the real cause. The
 * fix is adding the current IP under Atlas → Network Access, not a client
 * option. (`family: 4` was tried and measured here: it failed identically to
 * the default, so it was removed rather than left in as cargo cult.)
 *
 * The shorter server-selection timeout is deliberate — failing in 10s and
 * retrying beats a caller hanging for the 30s default on a connection that
 * is already known-bad.
 */
const CONNECT_OPTIONS = {
  serverSelectionTimeoutMS: 10000,
  retryWrites: true,
  retryReads: true,
} as const;

const MAX_ATTEMPTS = 5;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Logs drops/recoveries so a mid-run disconnect is visible instead of
 * surfacing only as mysteriously hanging requests. */
const attachConnectionLogging = (): void => {
  const connection = mongoose.connection;
  connection.on("disconnected", () => {
    // eslint-disable-next-line no-console
    console.warn("[db] MongoDB disconnected — driver will attempt to reconnect.");
  });
  connection.on("reconnected", () => {
    // eslint-disable-next-line no-console
    console.log("[db] MongoDB reconnected.");
  });
  connection.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.warn("[db] MongoDB connection error:", err instanceof Error ? err.message : err);
  });
};

export const connectDB = async (): Promise<void> => {
  attachConnectionLogging();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const conn = await mongoose.connect(env.mongoUri, CONNECT_OPTIONS);
      // eslint-disable-next-line no-console
      console.log(`[db] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
      await ensureBookVectorIndex();
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Transient Atlas drops are common enough here that a single failed
      // handshake shouldn't kill the process — retry with backoff first.
      // eslint-disable-next-line no-console
      console.warn(`[db] MongoDB connection attempt ${attempt}/${MAX_ATTEMPTS} failed: ${message}`);
      if (/SSL alert number 80|Could not connect to any servers/i.test(message)) {
        // This error reads like a TLS/certificate problem but is almost
        // always Atlas rejecting an IP that isn't on the access list — and
        // a dynamic home IP drifts, so a setup that worked yesterday breaks.
        // eslint-disable-next-line no-console
        console.warn(
          "[db] Hint: this usually means this machine's current public IP isn't on the Atlas access list. " +
            "Check Atlas → Network Access (see your IP at https://api.ipify.org)."
        );
      }

      if (attempt === MAX_ATTEMPTS) {
        // eslint-disable-next-line no-console
        console.error("[db] MongoDB unreachable after all retries — exiting.");
        process.exit(1);
      }
      await wait(Math.min(2000 * 2 ** (attempt - 1), 15000));
    }
  }
};

export const disconnectDB = async (): Promise<void> => {
  await mongoose.disconnect();
};
