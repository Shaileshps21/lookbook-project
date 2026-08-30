import { Types } from "mongoose";
import { Book, type IBook } from "../models/Book";
import { cosineSimilarity } from "./embeddings";

export const BOOK_VECTOR_INDEX = "book_vector_index";

interface FindSimilarOptions {
  excludeIds?: string[];
  limit?: number;
}

/**
 * Finds books whose embedding is closest to `queryVector`. Tries Atlas
 * Vector Search first (fast, scales); if that's unavailable on this cluster
 * tier or the index isn't ready yet, falls back to an in-process cosine-
 * similarity scan. Fine at this app's book-catalog scale, not meant to scale
 * to a large catalog — that's exactly what the Atlas path is for.
 */
export const findSimilarByVector = async (
  queryVector: number[],
  { excludeIds = [], limit = 8 }: FindSimilarOptions = {}
): Promise<IBook[]> => {
  const excludeObjectIds = excludeIds.map((id) => new Types.ObjectId(id));

  try {
    const results = await Book.aggregate([
      {
        $vectorSearch: {
          index: BOOK_VECTOR_INDEX,
          path: "embedding",
          queryVector,
          numCandidates: Math.max(limit * 15, 100),
          limit: limit + excludeObjectIds.length,
        },
      },
      { $match: { _id: { $nin: excludeObjectIds } } },
      { $limit: limit },
      { $unset: "embedding" },
    ]);
    // $vectorSearch returns plain aggregation objects, not hydrated Mongoose
    // documents — without this, they'd skip the schema's toJSON transform
    // and serialize with raw _id/__v instead of the `id` field every other
    // endpoint (and the whole frontend) expects.
    if (results.length > 0) return results.map((doc) => Book.hydrate(doc));
    // An empty result can legitimately mean "no matches" OR "index not
    // ready/missing" — fall through to the manual scan either way so a
    // freshly-created index doesn't produce a silently empty homepage.
  } catch {
    // Atlas Vector Search not available on this cluster/index — fall back below.
  }

  const candidates = await Book.find({
    _id: { $nin: excludeObjectIds },
    embedding: { $exists: true, $ne: [] },
  }).select("+embedding");

  return candidates
    .map((book) => ({ book, score: cosineSimilarity(queryVector, book.embedding ?? []) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ book }) => {
      book.embedding = undefined;
      return book;
    });
};
