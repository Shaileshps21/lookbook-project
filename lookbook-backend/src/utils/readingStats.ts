import { Order } from "../models/Order";
import { UserActivity } from "../models/UserActivity";
import type { IBook } from "../models/Book";

const DAY_MS = 24 * 60 * 60 * 1000;
const dateKey = (d: Date) => d.toISOString().slice(0, 10);

const mostFrequent = (values: string[], top = 3): string[] => {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, top).map(([v]) => v);
};

export interface ReadingStats {
  booksRead: number;
  finishedBookIds: string[];
  moneySaved: number;
  favouriteGenres: string[];
  favouriteAuthors: string[];
  booksFinishedThisMonth: number;
  streak: number;
  calendar: { date: string; count: number }[];
  monthlyBooks: { month: string; count: number }[];
  genreBreakdown: { genre: string; count: number }[];
}

/**
 * Shared by `readingController.getReadingStats` (the owner's private view,
 * which layers `readingGoal` on top) and `userController.getPublicProfile`
 * (a public-safe read of someone else's streak/genre taste) — factored out
 * so the Mongo aggregation logic exists in exactly one place rather than
 * being copied a second time for the profile page.
 */
export const computeReadingStats = async (userId: string): Promise<ReadingStats> => {
  const orders = await Order.find({ user: userId }).populate("items.book");
  const finishedActivities = await UserActivity.find({ user: userId, action: "finished" }).sort("-createdAt");

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

  return {
    booksRead: finishedBookIds.length,
    finishedBookIds,
    moneySaved,
    favouriteGenres,
    favouriteAuthors,
    booksFinishedThisMonth: finishedThisMonth,
    streak,
    calendar: [...calendarCounts.entries()].map(([date, count]) => ({ date, count })),
    monthlyBooks,
    genreBreakdown,
  };
};
