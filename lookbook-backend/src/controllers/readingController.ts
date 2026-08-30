import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { Order } from "../models/Order";
import { UserActivity } from "../models/UserActivity";
import type { IBook } from "../models/Book";
import { logActivity } from "../utils/logActivity";

const DAY_MS = 24 * 60 * 60 * 1000;
const dateKey = (d: Date) => d.toISOString().slice(0, 10);

const mostFrequent = (values: string[], top = 3): string[] => {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, top).map(([v]) => v);
};

/** Marks a book the user has rented/bought as "finished" — the explicit
 * signal the current Order model has no other way to capture (see
 * future.md 1.4 §2: order status never actually transitions to Delivered/
 * Returned in this app today, so this is the real source of "books read"). */
export const markBookFinished = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { bookId } = req.params;
  const owned = await Order.exists({ user: req.user.id, "items.book": bookId });
  if (!owned) {
    throw ApiError.badRequest("You can only mark a rented or purchased book as finished.");
  }

  logActivity(req.user.id, bookId, "finished");
  return ApiResponse.ok(res, null, "Marked as finished");
});

export const getReadingStats = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const orders = await Order.find({ user: req.user.id }).populate("items.book");
  const finishedActivities = await UserActivity.find({ user: req.user.id, action: "finished" }).sort("-createdAt");

  const rentItems = orders.flatMap((o) => o.items.filter((i) => i.mode === "rent"));
  const allBooks = orders.flatMap((o) => o.items.map((i) => i.book as unknown as IBook)).filter(Boolean);

  const moneySaved = rentItems.reduce((sum, item) => {
    const book = item.book as unknown as IBook;
    if (!book) return sum;
    return sum + Math.max(book.buyPrice - item.price, 0) * item.quantity;
  }, 0);

  const favouriteGenres = mostFrequent(allBooks.map((b) => b.category));
  const favouriteAuthors = mostFrequent(allBooks.map((b) => b.author));

  const finishedDays = [...new Set(finishedActivities.map((a) => dateKey(a.createdAt)))].sort().reverse();

  // A streak is still "alive" if today has an entry, or if today doesn't
  // (yet) but yesterday does — the current day isn't over. Otherwise it's 0.
  const finishedDaySet = new Set(finishedDays);
  let streak = 0;
  let cursor = new Date();
  if (!finishedDaySet.has(dateKey(cursor))) {
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  while (finishedDaySet.has(dateKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const finishedThisMonth = finishedActivities.filter((a) => a.createdAt >= startOfMonth).length;

  const ninetyDaysAgo = new Date(now.getTime() - 90 * DAY_MS);
  const calendarCounts = new Map<string, number>();
  finishedActivities
    .filter((a) => a.createdAt >= ninetyDaysAgo)
    .forEach((a) => {
      const key = dateKey(a.createdAt);
      calendarCounts.set(key, (calendarCounts.get(key) ?? 0) + 1);
    });

  const finishedBookIds = [...new Set(finishedActivities.map((a) => a.book.toString()))];

  // Last 12 months of "finished" activity, oldest first, keyed "YYYY-MM" —
  // backs the Recharts monthly BarChart. Built off the same finishedActivities
  // query rather than a separate aggregation since it's already in memory.
  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = (d: Date) => d.toLocaleDateString("en-US", { month: "short" });
  const monthlyCounts = new Map<string, number>();
  finishedActivities.forEach((a) => {
    const key = monthKey(a.createdAt);
    monthlyCounts.set(key, (monthlyCounts.get(key) ?? 0) + 1);
  });
  const monthlyBooks: { month: string; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthlyBooks.push({ month: monthLabel(d), count: monthlyCounts.get(monthKey(d)) ?? 0 });
  }

  // Full genre breakdown (not just the top-3 favourites above) — backs the
  // Recharts PieChart, counted from actual order history.
  const genreCounts = new Map<string, number>();
  allBooks.forEach((b) => {
    if (!b.category) return;
    genreCounts.set(b.category, (genreCounts.get(b.category) ?? 0) + 1);
  });
  const genreBreakdown = [...genreCounts.entries()]
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count);

  return ApiResponse.ok(res, {
    booksRead: finishedBookIds.length,
    finishedBookIds,
    moneySaved,
    favouriteGenres,
    favouriteAuthors,
    readingGoal: req.user.preferences.readingGoal ?? null,
    booksFinishedThisMonth: finishedThisMonth,
    streak,
    calendar: [...calendarCounts.entries()].map(([date, count]) => ({ date, count })),
    monthlyBooks,
    genreBreakdown,
  });
});

const SUSTAINABILITY_ASSUMPTIONS = {
  paperKgPerRental: 0.75, // illustrative: avg paper saved per rental vs. buying new
  co2KgPerRental: 2.5, // illustrative: avg CO2 saved per rental vs. new print run
  rentalsPerTreeSaved: 25, // illustrative: ~25 book-rentals worth of paper ≈ 1 tree
};

export const getSustainabilityStats = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const [personalRentalCount, communityRentalCount] = await Promise.all([
    Order.aggregate([
      { $match: { user: req.user._id } },
      { $unwind: "$items" },
      { $match: { "items.mode": "rent" } },
      { $group: { _id: null, count: { $sum: "$items.quantity" } } },
    ]),
    Order.aggregate([
      { $unwind: "$items" },
      { $match: { "items.mode": "rent" } },
      { $group: { _id: null, count: { $sum: "$items.quantity" } } },
    ]),
  ]);

  const personal = personalRentalCount[0]?.count ?? 0;
  const community = communityRentalCount[0]?.count ?? 0;

  const impact = (rentals: number) => ({
    booksReused: rentals,
    paperSavedKg: Math.round(rentals * SUSTAINABILITY_ASSUMPTIONS.paperKgPerRental * 10) / 10,
    co2ReducedKg: Math.round(rentals * SUSTAINABILITY_ASSUMPTIONS.co2KgPerRental * 10) / 10,
    treesSaved: Math.round((rentals / SUSTAINABILITY_ASSUMPTIONS.rentalsPerTreeSaved) * 10) / 10,
  });

  return ApiResponse.ok(res, {
    personal: impact(personal),
    community: impact(community),
    assumptions: SUSTAINABILITY_ASSUMPTIONS,
  });
});
