import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { generateJson } from "../utils/ai";
import { Book } from "../models/Book";
import { Category } from "../models/Category";
import { searchExternalBooks, type ExternalBookResult } from "../utils/openLibraryApi";
import { env } from "../config/env";

const GEMINI_URL = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.gemini.apiKey}`;

/**
 * Vision extraction over a local image buffer, sent as base64 inline data
 * (the shared generateVisionJson helper fetches from a URL, which doesn't
 * work for a multer upload that hasn't been pushed to Cloudinary yet).
 */
const extractFromImage = async <T>(mimeType: string, base64Data: string, prompt: string): Promise<T | null> => {
  if (!env.gemini.apiKey) return null;
  try {
    const res = await fetch(GEMINI_URL("gemini-2.5-flash"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: base64Data } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { candidates?: { content: { parts: { text: string }[] } }[] };
    const text = body.candidates?.[0]?.content.parts.map((p) => p.text).join("");
    if (!text) return null;
    return JSON.parse(text.replace(/```json|```/g, "").trim()) as T;
  } catch {
    return null;
  }
};

/**
 * AI OCR Book Upload (future.md §3.1).
 *
 * Seller uploads one photo of a book cover → Gemini Vision extracts
 * title/author/ISBN/publisher/language/category as strict JSON → we
 * cross-check the ISBN against our own catalog and Open Library to fill any
 * gaps → a Groq/Gemini text call predicts suggested rent/sell prices from the
 * confirmed metadata. The seller always edits before confirming; the AI never
 * auto-publishes.
 */

interface VisionBookExtract {
  title?: string;
  author?: string;
  isbn?: string;
  publisher?: string;
  published?: string;
  language?: string;
  category?: string;
  pages?: number;
  confidence?: number;
}

interface PricePrediction {
  suggestedRentPrice: number;
  suggestedBuyPrice: number;
  demandScore: number;
  reasoning: string;
}

interface BookScanResult {
  title: string;
  author: string;
  isbn?: string;
  publisher?: string;
  published?: string;
  language: string;
  category?: string;
  pages?: number;
  suggestedRentPrice: number;
  suggestedBuyPrice: number;
  demandScore: number;
  alreadyInCatalog: boolean;
  matchingBookId?: string;
}

/** Cross-check a bare ISBN against our own catalog (dedupe signal). */
const findCatalogMatchByIsbn = async (isbn?: string) => {
  if (!isbn) return null;
  const normalized = isbn.replace(/[^0-9Xx]/g, "").toUpperCase();
  if (normalized.length < 10) return null;
  return Book.findOne({ isbn: { $in: [normalized, isbn] } }).select("title author category");
};

/**
 * Prices from a page count when the AI text model is unavailable — the same
 * rule-based approach the Open Library importer uses, so behavior is
 * consistent whether or not an LLM key is configured.
 */
const ruleBasedPrices = (pages?: number): PricePrediction => {
  const pagesSafe = pages && pages > 0 ? pages : 250;
  const suggestedBuyPrice = Math.max(99, Math.round(pagesSafe * 1.25));
  const suggestedRentPrice = Math.max(29, Math.round(suggestedBuyPrice * 0.2));
  return {
    suggestedRentPrice,
    suggestedBuyPrice,
    demandScore: 50,
    reasoning: `Estimated from a ${pagesSafe}-page book (rule-based fallback).`,
  };
};

const predictPrices = async (title: string, author: string, category: string | undefined, pages?: number): Promise<PricePrediction> => {
  const prompt = `Given this used book for resale on a book rental/selling platform, predict a sensible asking (sell) price and rental price in Indian Rupees (INR).

Title: "${title}"
Author: "${author}"
Category: ${category ?? "Unknown"}
Pages: ${pages ?? "Unknown"}

Base the estimate on typical used-book pricing for this genre in the Indian market. A 200-page non-fiction paperback typically sells for around ₹250-₹300 and rents for about 20% of the sell price.`;

  const prediction = await generateJson<PricePrediction>(prompt, `{"suggestedRentPrice": number, "suggestedBuyPrice": number, "demandScore": number (0-100), "reasoning": string (one sentence)}`);
  if (!prediction || !prediction.suggestedBuyPrice) return ruleBasedPrices(pages);
  return prediction;
};

/**
 * POST /api/listings/scan — image (multer) → structured book metadata + price
 * suggestions for a pre-filled sell-listing form.
 */
export const scanBookCover = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const file = req.file;
  if (!file) throw ApiError.badRequest("No book cover image provided.");

  const extraction = await extractFromImage<VisionBookExtract>(
    file.mimetype,
    file.buffer.toString("base64"),
    `Extract book metadata from this photo of a book cover (or cover+spine). Be conservative: if you can't read a field, omit it. Look for the title, author, ISBN, publisher, publication date, language, genre/category, and page count if printed.\n\nRespond with ONLY valid JSON matching this shape, no markdown fences:\n{"title": string, "author": string, "isbn": string, "publisher": string, "published": string, "language": string, "category": string, "pages": number, "confidence": number (0-1)}`
  );

  if (!extraction || !extraction.title) {
    throw ApiError.badRequest(
      "We couldn't read that image as a book cover. Try a clearer, front-facing photo with the title visible."
    );
  }

  const title = extraction.title.trim();
  const author = extraction.author?.trim() ?? "";

  // Cross-check ISBN against our own catalog (a strong dedupe signal).
  const catalogMatch = await findCatalogMatchByIsbn(extraction.isbn);
  let external: ExternalBookResult | null = null;

  // If the vision model left ISBN/publisher gaps, fill them from Open Library.
  if (!extraction.isbn || !extraction.publisher || !extraction.pages) {
    try {
      const results = await searchExternalBooks(`${title} ${author}`.trim(), 1);
      if (results.length > 0) external = results[0];
    } catch {
      external = null;
    }
  }

  const isbn = extraction.isbn ?? external?.isbn;
  const publisher = extraction.publisher ?? external?.publisher;
  const published = extraction.published ?? external?.published;
  const pages = extraction.pages ?? external?.pages;
  const language = extraction.language ?? "English";

  // Validate the category against what actually exists in the catalog so the
  // seller's pre-filled dropdown always has a real option.
  let category = extraction.category;
  if (category) {
    const existing = await Category.findOne({ name: { $regex: `^${category}$`, $options: "i" } });
    if (!existing) category = undefined;
  }

  const prices = await predictPrices(title, author, category, pages);

  const result: BookScanResult = {
    title,
    author,
    isbn,
    publisher,
    published,
    language,
    category,
    pages,
    suggestedRentPrice: prices.suggestedRentPrice,
    suggestedBuyPrice: prices.suggestedBuyPrice,
    demandScore: prices.demandScore,
    alreadyInCatalog: Boolean(catalogMatch),
    matchingBookId: catalogMatch?.id,
  };

  return ApiResponse.ok(res, result, "Book cover scanned");
});

/**
 * POST /api/listings/scan-price — price suggestion for a manually-entered
 * title (used when the seller doesn't have a cover photo, or wants a second
 * opinion). Simple text → price prediction.
 */
export const suggestListingPrice = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { title, author, category, pages } = req.body as {
    title?: string;
    author?: string;
    category?: string;
    pages?: number;
  };
  if (!title || !title.trim()) throw ApiError.badRequest("A book title is required.");

  const prices = await predictPrices(title.trim(), author?.trim() ?? "", category, pages);
  return ApiResponse.ok(res, prices, "Price suggestion generated");
});
