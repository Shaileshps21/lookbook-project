import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { Listing } from "../models/Listing";
import { Book } from "../models/Book";
import { Category } from "../models/Category";
import { User } from "../models/User";
import { generateEmbedding, bookEmbeddingText } from "../utils/embeddings";
import { generateJson, generateVisionJson } from "../utils/ai";
import type { IAiSummary } from "../models/Book";
import { invalidateCache } from "../config/redis";
import { CATEGORIES_CACHE_KEY } from "./categoryController";

/**
 * AI Duplicate Detection (future.md §3.6).
 * Runs async after listing creation — never blocks the create response.
 * Step 1: fuzzy title+author match against existing catalog.
 * Step 2: if a candidate exists and both have cover images, ask Gemini Vision
 *         to compare them ("same book/edition?") and set duplicateFlag if yes.
 */
const runDuplicateDetection = async (listingId: string, title: string, author: string, images: string[]) => {
  try {
    // 1. Fuzzy text match — case-insensitive partial match on title + exact-ish author
    const candidates = await Book.find({
      title: { $regex: title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" },
      author: { $regex: author.split(" ")[0], $options: "i" },
    }).limit(3);

    if (candidates.length === 0) return;

    const candidate = candidates[0];

    // 2. If both have images, use vision model for a definitive comparison
    const listingImage = images[0];
    let duplicateFlag = false;
    let reason = `Title/author closely matches existing book: "${candidate.title}" by ${candidate.author}`;

    if (listingImage && candidate.image && !candidate.image.startsWith("/books/")) {
      const verdict = await generateVisionJson<{ sameBook: boolean; reason: string }>(
        listingImage,
        `Compare this book cover image with a known book: "${candidate.title}" by ${candidate.author}. Does this appear to be the same book or edition?`,
        '{ "sameBook": boolean, "reason": string (one sentence) }'
      );
      if (verdict) {
        duplicateFlag = verdict.sameBook;
        reason = verdict.reason;
      } else {
        // Vision failed — fall back to text-match alone as a soft flag
        duplicateFlag = true;
      }
    } else {
      // No image comparison possible — soft flag based on text match
      duplicateFlag = true;
    }

    if (duplicateFlag) {
      await Listing.findByIdAndUpdate(listingId, {
        duplicateFlag: true,
        duplicateCandidate: candidate._id,
        duplicateReason: reason,
      });
    }
  } catch {
    // eslint-disable-next-line no-console
    console.warn(`[duplicate-detection] Failed for listing ${listingId}`);
  }
};

export const createListing = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const listing = await Listing.create({ ...req.body, user: req.user.id });

  // Run duplicate detection in the background — doesn't block the response
  runDuplicateDetection(
    listing.id,
    listing.title,
    listing.author,
    listing.images
  );

  return ApiResponse.created(res, listing, "Listing submitted for review");
});

export const getMyListings = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const listings = await Listing.find({ user: req.user.id }).sort("-createdAt");
  return ApiResponse.ok(res, listings);
});

export const getAllListings = asyncHandler(async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.duplicateFlag === "true") filter.duplicateFlag = true;

  const listings = await Listing.find(filter)
    .sort("-createdAt")
    .populate("user", "name email")
    .populate("duplicateCandidate", "title author image");
  return ApiResponse.ok(res, listings);
});

// A used-book listing has one asking price, not separate rent/buy prices —
// this is a simple, documented starting ratio; the seller can edit it after
// the book lands in their inventory.
const DEFAULT_RENT_RATIO = 0.2;

export const updateListingStatus = asyncHandler(async (req: Request, res: Response) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) throw ApiError.notFound("Listing not found");

  const wasAlreadyApproved = listing.status === "Approved";
  listing.status = req.body.status;

  if (listing.status === "Approved" && !wasAlreadyApproved && !listing.linkedBookId) {
    const book = await Book.create({
      title: listing.title,
      author: listing.author,
      image: listing.images[0],
      category: listing.category,
      rentPrice: Math.round(listing.price * DEFAULT_RENT_RATIO),
      buyPrice: listing.price,
      description: listing.description || `A ${listing.condition.toLowerCase()}-condition copy listed by a LookBook seller.`,
      language: "English",
      stock: 1,
      tags: [listing.condition.toLowerCase()],
      sellerId: listing.user,
      condition: listing.condition,
    });

    listing.linkedBookId = book.id;

    await Promise.all([
      Category.findOneAndUpdate(
        { name: book.category },
        { $inc: { count: 1 } },
        { upsert: true, setDefaultsOnInsert: true }
      ),
      User.findByIdAndUpdate(listing.user, { isSeller: true }),
    ]);
    await invalidateCache(CATEGORIES_CACHE_KEY);

    generateEmbedding(bookEmbeddingText(book))
      .then((embedding) => embedding && Book.updateOne({ _id: book.id }, { embedding }))
      .catch(() => {
        // eslint-disable-next-line no-console
        console.warn(`[embeddings] Failed to embed seller book ${book.id}`);
      });

    generateJson<IAiSummary>(
      `Given this book's description, produce a reader-facing summary.\n${bookEmbeddingText(book)}`,
      `{"keyTakeaways": string[] (3-5 items), "difficulty": "Beginner"|"Intermediate"|"Advanced", "readingTimeHours": number, "targetAudience": string (one sentence), "topicsCovered": string[] (3-6 items)}`
    )
      .then((summary) => summary && Book.updateOne({ _id: book.id }, { aiSummary: summary }))
      .catch(() => {
        // eslint-disable-next-line no-console
        console.warn(`[ai] Failed to summarize seller book ${book.id}`);
      });
  }

  await listing.save();
  return ApiResponse.ok(res, listing, "Listing status updated");
});

export const deleteListing = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const listing = await Listing.findById(req.params.id);
  if (!listing) throw ApiError.notFound("Listing not found");

  if (listing.user.toString() !== req.user.id && req.user.role !== "admin") {
    throw ApiError.forbidden("You can only delete your own listings.");
  }

  await listing.deleteOne();
  return ApiResponse.ok(res, null, "Listing deleted");
});
