import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiFeatures } from "../utils/apiFeatures";
import { Book, type IBook, type IAiSummary } from "../models/Book";
import { Category } from "../models/Category";
import { generateEmbedding, bookEmbeddingText } from "../utils/embeddings";
import { generateJson } from "../utils/ai";
import { fetchBookByIsbn, type ExternalBookResult } from "../utils/openLibraryApi";
import { logActivity } from "../utils/logActivity";
import { createBookSchema } from "../validators/bookValidators";
import { invalidateCache } from "../config/redis";
import { CATEGORIES_CACHE_KEY } from "./categoryController";
import { Shelf } from "../models/Shelf";
import { User } from "../models/User";
import { notify } from "../utils/notify";
import { sendMail, buildPriceDropHtml } from "../utils/mailer";
import { env } from "../config/env";

/** Best-effort — a book is usable immediately; its embedding fills in async. */
const backfillEmbedding = (book: IBook) => {
  generateEmbedding(bookEmbeddingText(book))
    .then(async (embedding) => {
      if (!embedding) return;
      await Book.updateOne({ _id: book.id }, { embedding });
    })
    .catch(() => {
      // eslint-disable-next-line no-console
      console.warn(`[embeddings] Failed to embed book ${book.id}`);
    });
};

/** Best-effort, computed once per book — see future.md 3.4 (AI Book Summary). */
const generateAiSummary = (book: IBook) => {
  generateJson<IAiSummary>(
    `Given this book's publisher description, produce a reader-facing summary.\nTitle: ${book.title}\nAuthor: ${book.author}\nDescription: ${book.description}`,
    `{"keyTakeaways": string[] (3-5 items), "difficulty": "Beginner"|"Intermediate"|"Advanced", "readingTimeHours": number, "targetAudience": string (one sentence), "topicsCovered": string[] (3-6 items)}`
  )
    .then(async (summary) => {
      if (!summary) return;
      await Book.updateOne({ _id: book.id }, { aiSummary: summary });
    })
    .catch(() => {
      // eslint-disable-next-line no-console
      console.warn(`[ai] Failed to summarize book ${book.id}`);
    });
};

/** Best-effort — notifies (in-app + email) every user who has this book on
 * any shelf, whenever an admin edit lowers its rent or buy price. */
const notifyWishlistersOfPriceDrop = async (book: IBook, oldBuyPrice: number, oldRentPrice: number): Promise<void> => {
  try {
    const shelves = await Shelf.find({ books: book.id }).select("user");
    const userIds = [...new Set(shelves.map((s) => s.user.toString()))];
    if (userIds.length === 0) return;

    const link = `${env.clientUrl}/books/${book.id}`;
    const droppedPrice = book.buyPrice < oldBuyPrice ? book.buyPrice : book.rentPrice;
    const oldPrice = book.buyPrice < oldBuyPrice ? oldBuyPrice : oldRentPrice;

    userIds.forEach((userId) => notify(userId, "price.drop", "Price drop on a wishlisted book", `"${book.title}" is now ₹${droppedPrice}.`, link));

    const users = await User.find({ _id: { $in: userIds } }).select("email emailPreferences");
    await Promise.all(
      users
        .filter((u) => u.emailPreferences?.priceDropAlerts !== false)
        .map((u) =>
          sendMail({
            to: u.email,
            subject: `Price drop: ${book.title}`,
            html: buildPriceDropHtml(book.title, oldPrice, droppedPrice, link),
          }).catch(() => {
            // eslint-disable-next-line no-console
            console.warn(`[mail] Failed to send price-drop email to ${u.email}`);
          })
        )
    );
  } catch {
    // eslint-disable-next-line no-console
    console.warn(`[notify] Failed to process price-drop alerts for book ${book.id}`);
  }
};

export const getBooks = asyncHandler(async (req: Request, res: Response) => {
  const features = new ApiFeatures<IBook>(Book.find(), req.query);
  const books = await features.search().filter().sort().paginate().query;
  const total = await features.countTotal();

  const page = Math.max(Number(req.query.page ?? 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit ?? 12), 1), 50);

  return ApiResponse.ok(res, books, "Books fetched successfully", {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

export const getBookById = asyncHandler(async (req: Request, res: Response) => {
  const book = await Book.findById(req.params.id);
  if (!book) throw ApiError.notFound("Book not found");

  if (req.user) logActivity(req.user.id, book.id, "view");

  return ApiResponse.ok(res, book);
});

/**
 * ISBN lookup for the seller barcode scanner (future.md Stretch #4). Checks
 * our own catalog first (dedupe + instant), then falls back to Open Library
 * by ISBN. Returns enough metadata to pre-fill a sell-listing form.
 */
export const getBookByIsbn = asyncHandler(async (req: Request, res: Response) => {
  const isbn = (req.params.isbn ?? "").replace(/[^0-9Xx]/g, "").toUpperCase();
  if (isbn.length < 10) throw ApiError.badRequest("A valid 10- or 13-digit ISBN is required.");

  // Catalog-first lookup tolerates separator formatting differences (e.g. the
  // seed catalogue stores "978-0735211292" while scanner/input is normalized
  // to "9780735211292"), so match with optional [- ] separators between digits.
  const isbnPattern = new RegExp(`^${isbn.split("").join("[- ]?")}$`);
  const catalogBook = await Book.findOne({ isbn: { $regex: isbnPattern } }).select("title author isbn publisher published pages category image rentPrice buyPrice");
  if (catalogBook) {
    return ApiResponse.ok(res, {
      source: "catalog",
      alreadyInCatalog: true,
      title: catalogBook.title,
      author: catalogBook.author,
      isbn,
      publisher: catalogBook.publisher,
      published: catalogBook.published,
      pages: catalogBook.pages,
      category: catalogBook.category,
      image: catalogBook.image,
      catalogBookId: catalogBook.id,
    }, "ISBN matched a catalog book");
  }

  let external: ExternalBookResult | null = null;
  try {
    external = await fetchBookByIsbn(isbn);
  } catch {
    external = null;
  }
  if (!external) {
    throw ApiError.notFound("We couldn't find a book for that ISBN. Check it and try again.");
  }

  return ApiResponse.ok(res, {
    source: "open-library",
    alreadyInCatalog: false,
    title: external.title,
    author: external.author,
    isbn,
    publisher: external.publisher,
    published: external.published,
    pages: external.pages,
    image: external.image,
    subjects: external.subjects,
  }, "ISBN resolved from Open Library");
});

export const getSimilarBooks = asyncHandler(async (req: Request, res: Response) => {
  const book = await Book.findById(req.params.id);
  if (!book) throw ApiError.notFound("Book not found");

  const similar = await Book.find({ _id: { $ne: book.id }, category: book.category }).limit(4);
  return ApiResponse.ok(res, similar);
});

export const createBook = asyncHandler(async (req: Request, res: Response) => {
  const book = await Book.create(req.body);

  await Category.findOneAndUpdate(
    { name: book.category },
    { $inc: { count: 1 } },
    { upsert: true, setDefaultsOnInsert: true }
  );
  await invalidateCache(CATEGORIES_CACHE_KEY);

  backfillEmbedding(book);
  generateAiSummary(book);

  return ApiResponse.created(res, book);
});

export const updateBook = asyncHandler(async (req: Request, res: Response) => {
  const before = await Book.findById(req.params.id).select("rentPrice buyPrice");
  if (!before) throw ApiError.notFound("Book not found");

  const book = await Book.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!book) throw ApiError.notFound("Book not found");

  if (["title", "author", "description", "category", "tags"].some((field) => field in req.body)) {
    backfillEmbedding(book);
  }
  if (["title", "author", "description"].some((field) => field in req.body)) {
    generateAiSummary(book);
  }

  if (book.buyPrice < before.buyPrice || book.rentPrice < before.rentPrice) {
    notifyWishlistersOfPriceDrop(book, before.buyPrice, before.rentPrice);
  }

  return ApiResponse.ok(res, book, "Book updated successfully");
});

export const deleteBook = asyncHandler(async (req: Request, res: Response) => {
  const book = await Book.findByIdAndDelete(req.params.id);
  if (!book) throw ApiError.notFound("Book not found");
  return ApiResponse.ok(res, null, "Book deleted successfully");
});

/**
 * Bulk-import books from client-parsed CSV rows. Each row is validated
 * against the same schema the single-create endpoint uses; valid rows are
 * inserted, invalid ones are reported back with their row number so the
 * admin can fix and re-upload just those.
 */
export const bulkImportBooks = asyncHandler(async (req: Request, res: Response) => {
  const { rows } = req.body as { rows: unknown[] };
  if (!Array.isArray(rows) || rows.length === 0) {
    throw ApiError.badRequest("No rows to import.");
  }

  const errors: { row: number; message: string }[] = [];
  const validRows: ReturnType<typeof createBookSchema.parse>[] = [];

  rows.forEach((row, index) => {
    const result = createBookSchema.safeParse(row);
    if (!result.success) {
      errors.push({
        row: index + 1,
        message: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      });
    } else {
      validRows.push(result.data);
    }
  });

  const created = validRows.length > 0 ? await Book.insertMany(validRows) : [];

  await Promise.all(
    [...new Set(created.map((b) => b.category))].map((category) =>
      Category.findOneAndUpdate(
        { name: category },
        { $inc: { count: created.filter((b) => b.category === category).length } },
        { upsert: true, setDefaultsOnInsert: true }
      )
    )
  );
  if (created.length > 0) await invalidateCache(CATEGORIES_CACHE_KEY);

  created.forEach((book) => {
    backfillEmbedding(book);
    generateAiSummary(book);
  });

  return ApiResponse.ok(
    res,
    { importedCount: created.length, errorCount: errors.length, errors },
    `Imported ${created.length} of ${rows.length} rows`
  );
});
