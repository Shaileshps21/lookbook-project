import { Queue, Worker, type Job } from "bullmq";
import { Book } from "../models/Book";
import { UserActivity } from "../models/UserActivity";
import { createQueueConnection, createWorkerConnection, queuesEnabled, attachQueueErrorHandler } from "./connection";

/**
 * Smart/dynamic rental pricing (future.md Stretch 2) — a rule-based scheduled
 * job that adjusts a book's rentPrice within admin-set bounds based on recent
 * demand signals. This is deliberately a simple rule-based version (the
 * roadmap says "start with a simple rule-based version before reaching for a
 * full ML model"):
 *
 *   demandScore = views*1  + wishlist*3 + rentals*5 + purchases*6  (last 7d)
 *
 * Higher-than-average demand for a book raises its rent price (toward the
 * cap); lower-than-average demand lowers it (toward the floor). Only books
 * with `pricing.enabled: true` are touched.
 */

const QUEUE_NAME = "smart-pricing";
const REPEAT_EVERY_MS = 24 * 60 * 60 * 1000; // once a day
const LOCK_DURATION_MS = 10 * 60 * 1000;
const WINDOW_DAYS = 7;

const SIGNAL_WEIGHTS: Record<string, number> = {
  view: 1,
  wishlist: 3,
  rent: 5,
  buy: 6,
};

/** A book's demand score and the category's recent mean, so we can judge a
 * single book against its peers (a thriller with 20 views may be a hit while
 * a self-help book with 20 views is quiet). */
const demandAnalysis = async (
  since: Date
): Promise<{ scores: Map<string, number>; categoryMeans: Map<string, number> }> => {
  const rows = await UserActivity.aggregate([
    { $match: { createdAt: { $gte: since }, action: { $in: Object.keys(SIGNAL_WEIGHTS) } } },
    {
      $lookup: {
        from: "books",
        localField: "book",
        foreignField: "_id",
        as: "bookInfo",
      },
    },
    { $unwind: "$bookInfo" },
    {
      $group: {
        _id: "$book",
        score: {
          $sum: {
            $multiply: [
              "$weight",
              { $switch: { branches: Object.entries(SIGNAL_WEIGHTS).map(([k, v]) => ({ case: { $eq: ["$action", k] }, then: v })), default: 1 } },
            ],
          },
        },
        category: { $first: "$bookInfo.category" },
      },
    },
  ]);

  const scores = new Map<string, number>();
  const byCategory: Record<string, number[]> = {};
  for (const row of rows) {
    scores.set(row._id.toString(), row.score);
    (byCategory[row.category] = byCategory[row.category] ?? []).push(row.score);
  }

  const categoryMeans = new Map<string, number>();
  for (const [cat, arr] of Object.entries(byCategory)) {
    categoryMeans.set(cat, arr.reduce((s, n) => s + n, 0) / arr.length);
  }
  return { scores, categoryMeans };
};

const runPricingSweep = async (): Promise<void> => {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const { scores, categoryMeans } = await demandAnalysis(since);

  // Only books an admin opted into — safe default.
  const candidates = await Book.find({ "pricing.enabled": true }).select(
    "title category rentPrice pricing"
  );

  let updated = 0;
  for (const book of candidates) {
    const p = book.pricing;
    if (!p) continue;
    if (p.minRentPrice >= p.maxRentPrice) continue; // badly configured — skip

    const score = scores.get(book.id) ?? 0;
    const mean = categoryMeans.get(book.category) ?? 0;
    // 0..~2.2 multiplier of the category mean; 1.0 clamp on hot factor.
    const hotFactor = mean > 0 ? score / mean : 1;
    // Perspective: without demand, price sits at the top of the window's
    // lower half; with high demand it approaches (but can't exceed) the cap.
    const base = (p.minRentPrice + p.maxRentPrice) / 2;
    const target = Math.max(
      p.minRentPrice,
      Math.min(p.maxRentPrice, Math.round(base * (0.6 + 0.4 * Math.min(hotFactor, 3))))
    );

    if (target === book.rentPrice) {
      if (!p.lastPricingAt) {
        p.lastPricingAt = new Date();
        p.lastReason = "Priced at baseline; no change needed this cycle.";
        await book.save();
      }
      continue;
    }

    const reason =
      target < book.rentPrice
        ? `Demand below category average; lowered from ₹${book.rentPrice} to ₹${target}.`
        : `Demand above category average; raised from ₹${book.rentPrice} to ₹${target}.`;

    book.rentPrice = target;
    p.lastPricingAt = new Date();
    p.lastReason = reason;
    await book.save();
    updated += 1;
  }
  // eslint-disable-next-line no-console
  console.log(`[pricing] Adjusted rent price on ${updated} of ${candidates.length} enabled books.`);
};

export const pricingQueue = queuesEnabled
  ? new Queue(QUEUE_NAME, { connection: createQueueConnection() })
  : null;

if (pricingQueue) attachQueueErrorHandler(pricingQueue, "smart-pricing");

export const startPricingWorker = (): void => {
  if (!queuesEnabled || !pricingQueue) return;

  const worker = new Worker(
    QUEUE_NAME,
    async (_job: Job) => {
      await runPricingSweep();
    },
    { connection: createWorkerConnection(), lockDuration: LOCK_DURATION_MS }
  );
  attachQueueErrorHandler(worker, "smart-pricing");

  pricingQueue
    .add("sweep", {}, { repeat: { every: REPEAT_EVERY_MS }, jobId: "smart-pricing-repeat" })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[queues] Failed to schedule smart-pricing sweep:", err);
    });
};