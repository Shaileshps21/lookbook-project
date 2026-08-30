import { Queue, Worker, type Job } from "bullmq";
import { Order } from "../models/Order";
import { User } from "../models/User";
import { Book } from "../models/Book";
import { UserActivity } from "../models/UserActivity";
import { AnalyticsSnapshot } from "../models/AnalyticsSnapshot";
import { createQueueConnection, createWorkerConnection, queuesEnabled, attachQueueErrorHandler } from "./connection";

const QUEUE_NAME = "analytics-rollup";
const REPEAT_EVERY_MS = 24 * 60 * 60 * 1000; // once a day
// The full rollup backfills a snapshot per day since the first order — on a
// fresh seed that is one day, but on an aged database it can take minutes.
const LOCK_DURATION_MS = 15 * 60 * 1000;

export const analyticsQueue = queuesEnabled
  ? new Queue(QUEUE_NAME, { connection: createQueueConnection() })
  : null;

if (analyticsQueue) attachQueueErrorHandler(analyticsQueue, "analytics");

const dayKey = (d: Date): string => d.toISOString().slice(0, 10);
const dayBounds = (key: string): [Date, Date] => {
  const start = new Date(`${key}T00:00:00.000Z`);
  const end = new Date(`${key}T23:59:59.999Z`);
  return [start, end];
};

/** Computes one day's business metrics (future.md §11.2) and upserts the
 * snapshot — a scheduled rollup rather than a live aggregation on every
 * admin dashboard load. Runs once per distinct calendar day found in order
 * history, so the very first run backfills the whole time series at once. */
const rollupDay = async (key: string): Promise<void> => {
  const [start, end] = dayBounds(key);

  const [revenueAgg, ordersCount, newUsers, activeUserIds, topRented, topSold] = await Promise.all([
    Order.aggregate([
      { $match: { paymentStatus: "paid", updatedAt: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
    Order.countDocuments({ paymentStatus: "paid", updatedAt: { $gte: start, $lte: end } }),
    User.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    UserActivity.distinct("user", { createdAt: { $gte: start, $lte: end } }),
    Order.aggregate([
      { $match: { paymentStatus: "paid", updatedAt: { $gte: start, $lte: end } } },
      { $unwind: "$items" },
      { $match: { "items.mode": "rent" } },
      { $group: { _id: "$items.book", count: { $sum: "$items.quantity" } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: "books", localField: "_id", foreignField: "_id", as: "book" } },
      { $unwind: "$book" },
      { $project: { _id: 0, bookId: "$_id", title: "$book.title", count: 1 } },
    ]),
    Order.aggregate([
      { $match: { paymentStatus: "paid", updatedAt: { $gte: start, $lte: end } } },
      { $unwind: "$items" },
      { $match: { "items.mode": "buy" } },
      { $group: { _id: "$items.book", count: { $sum: "$items.quantity" } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: "books", localField: "_id", foreignField: "_id", as: "book" } },
      { $unwind: "$book" },
      { $project: { _id: 0, bookId: "$_id", title: "$book.title", count: 1 } },
    ]),
  ]);

  const genrePopularity = await Book.aggregate([
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $project: { _id: 0, category: "$_id", count: 1 } },
  ]);

  // Seller-attributable share of the day's revenue — books with a sellerId.
  const sellerRevenueAgg = await Order.aggregate([
    { $match: { paymentStatus: "paid", updatedAt: { $gte: start, $lte: end } } },
    { $unwind: "$items" },
    { $lookup: { from: "books", localField: "items.book", foreignField: "_id", as: "book" } },
    { $unwind: "$book" },
    { $match: { "book.sellerId": { $exists: true, $ne: null } } },
    { $group: { _id: null, total: { $sum: { $multiply: ["$items.price", "$items.quantity"] } } } },
  ]);

  await AnalyticsSnapshot.findOneAndUpdate(
    { date: key },
    {
      date: key,
      revenue: revenueAgg[0]?.total ?? 0,
      ordersCount,
      newUsers,
      activeUsers: activeUserIds.length,
      // No real membership-purchase flow exists yet (Plans are display-only,
      // see models/Plan.ts) — left at 0 rather than fabricated.
      membershipRevenue: 0,
      sellerRevenue: sellerRevenueAgg[0]?.total ?? 0,
      topRentedBooks: topRented,
      topSoldBooks: topSold,
      genrePopularity,
    },
    { upsert: true }
  );
};

const runFullRollup = async (): Promise<void> => {
  const firstOrder = await Order.findOne().sort("createdAt").select("createdAt");
  const firstDay = firstOrder ? new Date(firstOrder.createdAt) : new Date();

  const days: string[] = [];
  const cursor = new Date(firstDay);
  cursor.setUTCHours(0, 0, 0, 0);
  const today = new Date();
  while (cursor <= today) {
    days.push(dayKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  for (const key of days) {
    await rollupDay(key);
  }
};

export const startAnalyticsWorker = (): void => {
  if (!queuesEnabled || !analyticsQueue) return;

  const worker = new Worker(
    QUEUE_NAME,
    async (_job: Job) => {
      await runFullRollup();
    },
    { connection: createWorkerConnection(), lockDuration: LOCK_DURATION_MS }
  );
  attachQueueErrorHandler(worker, "analytics");

  analyticsQueue
    .add(
      "rollup",
      {},
      {
        repeat: { every: REPEAT_EVERY_MS },
        jobId: "analytics-rollup-repeat",
      }
    )
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[queues] Failed to schedule analytics rollup:", err);
    });

  // Also run once immediately so a freshly-deployed instance has data to
  // show right away instead of waiting up to 24h for the first tick.
  analyticsQueue.add("rollup-initial", {}).catch(() => {});
};
