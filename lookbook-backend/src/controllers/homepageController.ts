import type { Request, Response } from "express";
import { Types } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { Book, type IBook } from "../models/Book";
import { Order } from "../models/Order";
import { UserActivity } from "../models/UserActivity";
import { User, type RecommendationArm } from "../models/User";
import { getCache, setCache } from "../config/redis";
import { averageVectors } from "../utils/embeddings";
import { findSimilarByVector } from "../utils/vectorSearch";
import { dedupeById } from "../utils/dedupeById";

const CACHE_TTL_SECONDS = 60 * 60; // 1 hour — see future.md 1.2 §4 (scheduled precompute is a Phase 7 refinement)
const SECTION_LIMIT = 8;
const TASTE_SAMPLE_SIZE = 10;

interface HomepagePayload {
  coldStart: boolean;
  // §13.3 — which recommendation arm produced this payload, echoed to the
  // frontend so impression/click/conversion events can be attributed.
  arm: RecommendationArm;
  // §13.8 — explainability: bookId → human-readable "why was this shown".
  reasons: Record<string, string>;
  newReleases: IBook[];
  popularInGenre: IBook[];
  continueReading: IBook[];
  recentlyViewed: IBook[];
  recommendedForYou: IBook[];
  becauseYouRead: { sourceBook: IBook | null; books: IBook[] };
  similarToWishlist: IBook[];
}

const guestHomepage = async (): Promise<HomepagePayload> => {
  const [newReleases, popularInGenre] = await Promise.all([
    Book.find().sort("-createdAt").limit(SECTION_LIMIT),
    Book.find().sort("-rating -reviewsCount").limit(SECTION_LIMIT),
  ]);

  return {
    coldStart: true,
    arm: "hybrid",
    reasons: {},
    newReleases,
    popularInGenre,
    continueReading: [],
    recentlyViewed: [],
    recommendedForYou: [],
    becauseYouRead: { sourceBook: null, books: [] },
    similarToWishlist: [],
  };
};

/**
 * §13.3 — assign (once) the A/B arm for this user. The field has no schema
 * default so that pre-existing users are randomized on their *first* homepage
 * fetch (no migration needed); a fresh account also gets randomized on first
 * contact. Persisted so the arm is stable across sessions.
 */
const ensureArm = async (userId: string, current: RecommendationArm | undefined): Promise<RecommendationArm> => {
  if (current === "hybrid" || current === "popularity") return current;
  const arm: RecommendationArm = Math.random() < 0.5 ? "hybrid" : "popularity";
  await User.findByIdAndUpdate(userId, { $set: { recommendationArm: arm } });
  return arm;
};

const buildPopularitySection = async (
  excludeIds: string[],
  limit: number
): Promise<{ popular: IBook[]; reason: string }> => {
  const excludeObjectIds = excludeIds.map((id) => new Types.ObjectId(id));
  const popular = await Book.find({ _id: { $nin: excludeObjectIds } })
    .sort("-rating -reviewsCount")
    .limit(limit);
  return { popular, reason: "Most popular with all readers" };
};

export const getHomepage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    return ApiResponse.ok(res, await guestHomepage());
  }

  const userId = req.user.id;
  const cacheKey = `homepage:${userId}`;
  const cached = await getCache<HomepagePayload>(cacheKey);
  if (cached) {
    return ApiResponse.ok(res, cached, "Success", { cached: true });
  }

  const arm = await ensureArm(userId, req.user.recommendationArm);

  const preferences = req.user.preferences;
  const excludeIds = req.user.wishlist.map((id) => id.toString());

  const [newReleases, activities, rentOrders] = await Promise.all([
    Book.find().sort("-createdAt").limit(SECTION_LIMIT),
    UserActivity.find({ user: userId }).sort("-weight -createdAt").limit(50).populate("book"),
    Order.find({ user: userId, "items.mode": "rent" }).populate("items.book"),
  ]);

  // Active rentals not yet marked returned, deduped — a book rented across
  // multiple orders (re-rented, or a test/demo account) must appear once,
  // not once per order.
  const continueReading = dedupeById(
    rentOrders
      .flatMap((order) => order.items.filter((item) => item.mode === "rent" && !item.returnedAt))
      .map((item) => item.book as unknown as IBook)
      .filter(Boolean)
  ).slice(0, SECTION_LIMIT);

  // .populate("book") means `a.book` is a hydrated Book document here, not a
  // bare ObjectId — always read its `.id` string, never `.toString()` the
  // populated doc itself (that stringifies the whole document, not the id).
  // A null book means the referenced book was since deleted; skip it.
  const activityBooks = activities
    .map((a) => ({ action: a.action, book: a.book as unknown as IBook | null }))
    .filter((a): a is { action: typeof a.action; book: IBook } => !!a.book);

  // Same dedup concern as continueReading — viewing a book more than once
  // logs a fresh UserActivity row each time, so the naive list can repeat
  // the same book several times before distinct titles show up at all.
  const recentlyViewed = dedupeById(
    activityBooks.filter((a) => a.action === "view").map((a) => a.book)
  ).slice(0, SECTION_LIMIT);

  const interactedBookIds = [...new Set(activityBooks.map((a) => a.book.id))];

  const popularInGenre = preferences.genres.length
    ? await Book.find({ category: { $in: preferences.genres } }).sort("-rating -reviewsCount").limit(SECTION_LIMIT)
    : [];

  const coldStart = interactedBookIds.length === 0 && preferences.genres.length === 0;

  const reasons: Record<string, string> = {};
  let recommendedForYou: IBook[] = [];
  let becauseYouRead: HomepagePayload["becauseYouRead"] = { sourceBook: null, books: [] };
  let similarToWishlist: IBook[] = [];

  if (arm === "popularity") {
    // §13.3 control arm — deliberately no personalization: every personalized
    // slot shows the same global-popularity shelf. Continue Reading / Recently
    // Viewed are historical state, not recommendations, so they stay.
    const { popular } = await buildPopularitySection(
      [...interactedBookIds, ...excludeIds],
      SECTION_LIMIT * 2
    );
    recommendedForYou = popular.slice(0, SECTION_LIMIT);
    becauseYouRead = { sourceBook: null, books: popular.slice(SECTION_LIMIT, SECTION_LIMIT * 2) };
    similarToWishlist = popular.slice(0, SECTION_LIMIT);
    for (const b of recommendedForYou) reasons[b.id] = "Most popular with all readers";
    for (const b of similarToWishlist) reasons[b.id] = reasons[b.id] ?? "Most popular with all readers";
  } else if (!coldStart) {
    // "Because You Read X" — the single highest-weighted recent book.
    const topActivity = activityBooks[0];
    if (topActivity) {
      const sourceBook = await Book.findById(topActivity.book.id).select("+embedding");
      if (sourceBook?.embedding?.length) {
        const books = await findSimilarByVector(sourceBook.embedding, {
          excludeIds: [...interactedBookIds, ...excludeIds],
          limit: SECTION_LIMIT,
        });
        becauseYouRead = { sourceBook, books };
        for (const b of books) reasons[b.id] = `Because you read ${sourceBook.title}`;
      }
    }

    // "Recommended For You" — taste vector averaged across recent activity.
    const topBookIds = [...new Set(activityBooks.slice(0, TASTE_SAMPLE_SIZE).map((a) => a.book.id))];
    if (topBookIds.length > 0) {
      const tasteBooks = await Book.find({ _id: { $in: topBookIds } }).select("+embedding");
      const tasteVector = averageVectors(tasteBooks.map((b) => b.embedding).filter((e): e is number[] => !!e?.length));
      if (tasteVector) {
        const books = await findSimilarByVector(tasteVector, {
          excludeIds: [...interactedBookIds, ...excludeIds],
          limit: SECTION_LIMIT,
        });
        recommendedForYou = books;
        for (const b of books) reasons[b.id] = "Similar to your recent reads";
      }
    }

    // "Similar To Wishlist" — averaged embedding of wishlisted books.
    if (excludeIds.length > 0) {
      const wishlistBooks = await Book.find({ _id: { $in: excludeIds } }).select("+embedding");
      const wishlistVector = averageVectors(
        wishlistBooks.map((b) => b.embedding).filter((e): e is number[] => !!e?.length)
      );
      if (wishlistVector) {
        const books = await findSimilarByVector(wishlistVector, {
          excludeIds: [...interactedBookIds, ...excludeIds],
          limit: SECTION_LIMIT,
        });
        similarToWishlist = books;
        for (const b of books) reasons[b.id] = "Because you wishlisted similar books";
      }
    }
  }

  for (const b of popularInGenre) reasons[b.id] = reasons[b.id] ?? `Trending in ${b.category}`;

  const payload: HomepagePayload = {
    coldStart,
    arm,
    reasons,
    newReleases,
    popularInGenre: popularInGenre.length ? popularInGenre : coldStart ? await Book.find().sort("-rating -reviewsCount").limit(SECTION_LIMIT) : [],
    continueReading,
    recentlyViewed,
    recommendedForYou,
    becauseYouRead,
    similarToWishlist,
  };

  await setCache(cacheKey, payload, CACHE_TTL_SECONDS);

  return ApiResponse.ok(res, payload);
});