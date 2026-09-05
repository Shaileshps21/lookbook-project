import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { Order } from "../models/Order";
import { logActivity } from "../utils/logActivity";
import { computeReadingStats } from "../utils/readingStats";

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

  const stats = await computeReadingStats(req.user.id);

  return ApiResponse.ok(res, {
    ...stats,
    readingGoal: req.user.preferences.readingGoal ?? null,
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
