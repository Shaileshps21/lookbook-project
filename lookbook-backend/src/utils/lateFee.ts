import { env } from "../config/env";
import type { IOrderItem } from "../models/Order";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Days a rental is overdue, counted from its due date to `asOf` (default now).
 * Returns 0 for anything not overdue. The grace is implicit: a rental due
 * today isn't late until the day has fully elapsed, so this floors rather
 * than rounds — being 3 hours late costs nothing, 25 hours costs one day.
 */
export const overdueDays = (dueDate: Date, asOf: Date = new Date()): number => {
  const ms = asOf.getTime() - dueDate.getTime();
  if (ms <= 0) return 0;
  return Math.floor(ms / DAY_MS);
};

/**
 * Late fee for a single rental item: per-day rate × days overdue × quantity.
 *
 * Charged up to the return date once returned, so a fee stops growing the
 * moment the book is back — an already-returned item's fee is historical and
 * must never change on a later sweep.
 */
export const calculateLateFee = (item: IOrderItem, asOf: Date = new Date()): number => {
  if (item.mode !== "rent" || !item.dueDate) return 0;
  const until = item.returnedAt ?? asOf;
  return overdueDays(item.dueDate, until) * env.rental.lateFeePerDay * item.quantity;
};
