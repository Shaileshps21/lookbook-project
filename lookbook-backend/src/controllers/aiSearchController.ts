import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { Book } from "../models/Book";
import { Category } from "../models/Category";
import { generateJson } from "../utils/ai";
import { generateEmbedding, cosineSimilarity } from "../utils/embeddings";
import { findSimilarByVector } from "../utils/vectorSearch";

interface ParsedQuery {
  category?: string;
  maxPrice?: number;
  minRating?: number;
  keywords: string[];
}

/**
 * "Horror books with a happy ending under ₹500" — see future.md 3.2.
 * Groq is designated for this kind of query-parsing task; substituted with
 * Gemini here (see src/utils/ai.ts) since the configured Groq key is
 * currently invalid.
 *
 * category/maxPrice/minRating are treated as hard constraints — a user who
 * says "under ₹500" means it, so vector similarity only ranks *within* the
 * qualifying set rather than being able to override a stated budget/genre.
 */
export const aiSearch = asyncHandler(async (req: Request, res: Response) => {
  const query = (req.query.q as string | undefined)?.trim();
  if (!query) throw ApiError.badRequest("Please provide a search query via ?q=");

  const categoryNames = (await Category.find().select("name")).map((c) => c.name);

  const parsed = await generateJson<ParsedQuery>(
    `Extract structured search filters from this book search query: "${query}".\n` +
      `Valid categories are exactly: ${categoryNames.join(", ")}. Only set "category" if the query clearly maps to one of these — otherwise put the genre/mood word in "keywords" instead and leave category unset.`,
    `{"category": string | undefined (must be one of the valid categories listed above, or omitted), "maxPrice": number | undefined (in rupees, if a budget is mentioned), "minRating": number | undefined (0-5, if quality is implied), "keywords": string[] (mood/theme/topic words, e.g. "happy ending", "beginner-friendly")}`
  );

  // Defensive: even with the constraint above, don't trust a hallucinated
  // category that doesn't actually exist — treat it as a keyword instead.
  if (parsed?.category && !categoryNames.some((c) => c.toLowerCase() === parsed.category?.toLowerCase())) {
    parsed.keywords = [...(parsed.keywords ?? []), parsed.category];
    parsed.category = undefined;
  }

  const hardFilter: Record<string, unknown> = {};
  if (parsed?.category) hardFilter.category = new RegExp(parsed.category, "i");
  if (parsed?.maxPrice) hardFilter.rentPrice = { $lte: parsed.maxPrice };
  if (parsed?.minRating) hardFilter.rating = { $gte: parsed.minRating };

  const hasHardConstraints = Object.keys(hardFilter).length > 0;
  const queryEmbedding = await generateEmbedding(query);

  if (!hasHardConstraints) {
    // Pure "vibe" query — rank the whole catalog by semantic similarity.
    const results = queryEmbedding ? await findSimilarByVector(queryEmbedding, { limit: 12 }) : [];
    return ApiResponse.ok(res, { results, interpretedAs: parsed });
  }

  // Hard constraints present — fetch the qualifying set, then rank it by
  // semantic relevance to the query (mood/theme words) rather than doing an
  // unconstrained vector search that could reintroduce out-of-budget results.
  const candidates = await Book.find(hardFilter).select(queryEmbedding ? "+embedding" : "");

  const results = queryEmbedding
    ? candidates
        .map((book) => ({ book, score: cosineSimilarity(queryEmbedding, book.embedding ?? []) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 12)
        .map(({ book }) => {
          book.embedding = undefined;
          return book;
        })
    : candidates.slice(0, 12);

  return ApiResponse.ok(res, { results, interpretedAs: parsed });
});
