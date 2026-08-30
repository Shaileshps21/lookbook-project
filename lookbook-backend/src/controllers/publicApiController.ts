import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { Book } from "../models/Book";
import { Category } from "../models/Category";

const sanitizeForPublic = (book: InstanceType<typeof Book>): Record<string, unknown> => {
  const b = book.toObject();
  return {
    id: b.id,
    title: b.title,
    author: b.author,
    category: b.category,
    rentPrice: b.rentPrice,
    buyPrice: b.buyPrice,
    rating: b.rating,
    reviewsCount: b.reviewsCount,
    description: b.description?.slice(0, 500),
    language: b.language,
    tags: b.tags ?? [],
    badge: b.badge,
  };
};

/**
 * Public read-only API (future.md Phase 12 stretch) — rate-limited, no auth,
 * a deliberately small surface for external consumers (hobby apps, library
 * integrations). List, detail, and categories only; write endpoints stay
 * behind auth/admin where they belong.
 */
export const publicBookList = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(Number(req.query.page ?? 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit ?? 12), 1), 50);
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const category = typeof req.query.category === "string" ? req.query.category : undefined;

  const filter: Record<string, unknown> = {};
  if (category && category !== "All") filter.category = category;
  if (search) filter.$or = [{ title: { $regex: search, $options: "i" } }, { author: { $regex: search, $options: "i" } }, { tags: { $regex: search, $options: "i" } }];

  const [books, total] = await Promise.all([Book.find(filter).sort("-rating").skip((page - 1) * limit).limit(limit), Book.countDocuments(filter)]);
  const totalPages = Math.max(Math.ceil(total / limit), 1);

  return ApiResponse.ok(res, books.map(sanitizeForPublic), "Books", {
    page,
    limit,
    total,
    totalPages,
  });
});

export const publicBookDetail = asyncHandler(async (req: Request, res: Response) => {
  const book = await Book.findById(req.params.id);
  if (!book) {
    return ApiResponse.ok(res, null, "Book not found");
  }
  return ApiResponse.ok(res, sanitizeForPublic(book));
});

export const publicCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await Category.find().sort("-count");
  return ApiResponse.ok(res, categories.map((c) => ({ id: c.id, name: c.name, count: c.count })));
});