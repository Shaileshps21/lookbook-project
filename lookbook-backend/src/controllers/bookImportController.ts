import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { Book } from "../models/Book";
import { Category } from "../models/Category";
import { searchExternalBooks, fetchWorkDescription, type ExternalBookResult } from "../utils/openLibraryApi";
import { generateEmbedding, bookEmbeddingText } from "../utils/embeddings";
import { invalidateCache } from "../config/redis";
import { logger } from "../utils/logger";
import { CATEGORIES_CACHE_KEY } from "./categoryController";

export const searchBooksApi = asyncHandler(async (req: Request, res: Response) => {
  const query = (req.query.q as string | undefined)?.trim();
  if (!query) throw ApiError.badRequest("A search query is required.");

  // Open Library is an external service; if it's unreachable (or the search
  // itself fails), surface a clean 503 rather than leaking a raw fetch error.
  let results: ExternalBookResult[];
  try {
    results = await searchExternalBooks(query, 24);
  } catch (err) {
    // Log the real cause — a bare `catch {}` here made a genuine outage
    // indistinguishable from a timeout or a rate-limit, which cost real
    // debugging time when the importer started failing.
    logger.warn({ err, query }, "[import] Open Library search failed");
    throw ApiError.serviceUnavailable("Couldn't reach the external book database. Check the connection and try again.");
  }

  // Flag results that already exist in our catalog (by ISBN, falling back to
  // title+author) so the admin UI can visually skip re-importing them.
  const isbns = results.map((r) => r.isbn).filter((v): v is string => !!v);
  const existingIsbns = new Set((await Book.find({ isbn: { $in: isbns } }).select("isbn")).map((b) => b.isbn));
  const existingTitleAuthor = new Set(
    (await Book.find({ title: { $in: results.map((r) => r.title) } }).select("title author")).map(
      (b) => `${b.title.toLowerCase()}|${b.author.toLowerCase()}`
    )
  );

  const withStatus = results.map((r) => ({
    ...r,
    alreadyImported:
      (r.isbn && existingIsbns.has(r.isbn)) || existingTitleAuthor.has(`${r.title.toLowerCase()}|${r.author.toLowerCase()}`),
  }));

  return ApiResponse.ok(res, withStatus);
});

// Open Library has no pricing — synthesize a plausible rent/buy pair from
// page count (a reasonable, transparent proxy for a book's heft/value)
// rather than a flat constant, so imported books aren't all priced alike.
const priceFromPages = (pages?: number): { rentPrice: number; buyPrice: number } => {
  const p = pages ?? 250;
  const buyPrice = Math.min(699, Math.max(149, Math.round((149 + p * 0.6) / 10) * 10));
  const rentPrice = Math.round(buyPrice * 0.18);
  return { rentPrice, buyPrice };
};

export const importBooksApi = asyncHandler(async (req: Request, res: Response) => {
  const { items, category } = req.body as { items: ExternalBookResult[]; category: string };
  if (!Array.isArray(items) || items.length === 0) throw ApiError.badRequest("No books selected to import.");
  if (!category?.trim()) throw ApiError.badRequest("A category is required for the imported books.");

  const created: InstanceType<typeof Book>[] = [];
  const skipped: { title: string; reason: string }[] = [];

  for (const item of items.slice(0, 50)) {
    const exists = item.isbn
      ? await Book.findOne({ isbn: item.isbn })
      : await Book.findOne({ title: item.title, author: item.author });
    if (exists) {
      skipped.push({ title: item.title, reason: "Already in catalog" });
      continue;
    }

    const description = (await fetchWorkDescription(item.sourceKey)) || `${item.title} by ${item.author}.`;
    const { rentPrice, buyPrice } = priceFromPages(item.pages);

    try {
      const book = await Book.create({
        title: item.title,
        author: item.author,
        image: item.image,
        category: category.trim(),
        rentPrice,
        buyPrice,
        description: description.slice(0, 2000),
        publisher: item.publisher,
        published: item.published,
        pages: item.pages,
        language: "English",
        isbn: item.isbn,
        stock: 5 + Math.floor(Math.random() * 15),
        tags: item.subjects.map((s) => s.toLowerCase()).slice(0, 6),
      });
      created.push(book);
    } catch (err) {
      skipped.push({ title: item.title, reason: err instanceof Error ? err.message : "Failed to create" });
    }
  }

  if (created.length > 0) {
    await Category.findOneAndUpdate(
      { name: category.trim() },
      { $inc: { count: created.length } },
      { upsert: true, setDefaultsOnInsert: true }
    );
    await invalidateCache(CATEGORIES_CACHE_KEY);

    // Best-effort, fire-and-forget — same pattern as the admin CSV import.
    // Embeddings feed vector search/recommendations; not blocking the
    // response on them keeps a batch import from timing out.
    created.forEach((book) => {
      generateEmbedding(bookEmbeddingText(book))
        .then((embedding) => embedding && Book.updateOne({ _id: book.id }, { embedding }))
        .catch(() => {
          // eslint-disable-next-line no-console
          console.warn(`[import] Failed to embed imported book ${book.id}`);
        });
    });
  }

  return ApiResponse.created(res, { imported: created.length, skipped }, `Imported ${created.length} books`);
});
