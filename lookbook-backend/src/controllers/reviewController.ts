import type { Request, Response } from "express";
import { Types } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { Review } from "../models/Review";
import { Book, type IReviewAnalysis } from "../models/Book";
import { Order } from "../models/Order";
import { generateJson } from "../utils/ai";
import { logActivity } from "../utils/logActivity";
import type { CreateReviewInput } from "../validators/reviewValidators";

const recalculateBookRating = async (bookId: string) => {
  const stats = await Review.aggregate([
    { $match: { book: new Types.ObjectId(bookId) } },
    { $group: { _id: "$book", avgRating: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);

  const { avgRating = 0, count = 0 } = stats[0] ?? {};

  await Book.findByIdAndUpdate(bookId, {
    rating: Math.round(avgRating * 10) / 10,
    reviewsCount: count,
  });

  return count as number;
};

/** Best-effort, re-run on every new review — see future.md 3.5 (AI Review Analysis). */
const refreshReviewAnalysis = (bookId: string, reviewCount: number) => {
  Review.find({ book: bookId })
    .sort("-createdAt")
    .limit(50)
    .then(async (reviews) => {
      if (reviews.length === 0) return;
      const analysis = await generateJson<Omit<IReviewAnalysis, "generatedAt" | "reviewCountAtGeneration">>(
        `Analyze these reader reviews and summarize sentiment.\n\n${reviews.map((r) => `- (${r.rating}/5) ${r.comment}`).join("\n")}`,
        `{"positivePercent": number (0-100), "commonPros": string[] (2-4 short phrases), "commonCons": string[] (0-4 short phrases), "emotionalTone": string (one short phrase)}`
      );
      if (!analysis) return;
      await Book.updateOne(
        { _id: bookId },
        { reviewAnalysis: { ...analysis, generatedAt: new Date(), reviewCountAtGeneration: reviewCount } }
      );
    })
    .catch(() => {
      // eslint-disable-next-line no-console
      console.warn(`[ai] Failed to analyze reviews for book ${bookId}`);
    });
};

/** A review gets the Verified Reader badge only if its author has an actually
 * completed (Delivered/Returned, paid) order containing this exact book —
 * checked at display time rather than stored on the review, so it stays
 * correct even if order history changes later. */
const getVerifiedReaderUserIds = async (bookId: string, userIds: string[]): Promise<Set<string>> => {
  if (userIds.length === 0) return new Set();

  const orders = await Order.find({
    user: { $in: userIds },
    paymentStatus: "paid",
    status: { $in: ["Delivered", "Returned"] },
    "items.book": bookId,
  }).select("user");

  return new Set(orders.map((o) => o.user.toString()));
};

export const getReviewsForBook = asyncHandler(async (req: Request, res: Response) => {
  const reviews = await Review.find({ book: req.params.id }).sort("-createdAt");
  const verifiedUserIds = await getVerifiedReaderUserIds(
    req.params.id,
    reviews.map((r) => r.user.toString())
  );

  const withBadge = reviews.map((review) => ({
    ...review.toJSON(),
    verifiedReader: verifiedUserIds.has(review.user.toString()),
  }));

  return ApiResponse.ok(res, withBadge);
});

export const createReview = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const book = await Book.findById(req.params.id);
  if (!book) throw ApiError.notFound("Book not found");

  const { rating, comment } = req.body as CreateReviewInput;

  const alreadyReviewed = await Review.findOne({ book: book.id, user: req.user.id });
  if (alreadyReviewed) {
    throw ApiError.conflict("You have already reviewed this book.");
  }

  const review = await Review.create({
    book: book.id,
    user: req.user.id,
    name: req.user.name,
    rating,
    comment,
  });

  const reviewCount = await recalculateBookRating(book.id);
  refreshReviewAnalysis(book.id, reviewCount);
  logActivity(req.user.id, book.id, "review");

  return ApiResponse.created(res, review, "Review submitted successfully");
});

export const deleteReview = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const review = await Review.findById(req.params.reviewId);
  if (!review) throw ApiError.notFound("Review not found");

  if (review.user.toString() !== req.user.id && req.user.role !== "admin") {
    throw ApiError.forbidden("You can only delete your own reviews.");
  }

  const bookId = review.book.toString();
  await review.deleteOne();
  await recalculateBookRating(bookId);

  return ApiResponse.ok(res, null, "Review deleted successfully");
});
