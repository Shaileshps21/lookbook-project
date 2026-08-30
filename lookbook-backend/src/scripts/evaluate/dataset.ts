import mongoose from "mongoose";
import { Book } from "../../models/Book";
import { UserActivity } from "../../models/UserActivity";
import { Order } from "../../models/Order";
import { cosineSimilarity } from "../../utils/embeddings";

/**
 * §13.2 offline evaluation data model. A `Dataset` is an anonymized snapshot
 * of books + interactions (UserActivity + paid rent/buy order items), split
 * chronologically into train (pre-T) and test (post-T) per user. Everything
 * here is deliberately schema-free (plain maps) so the evaluation scripts can
 * run against a JSON snapshot too, not only a live DB.
 */

export interface EvalBook {
  id: string;
  title: string;
  author: string;
  category: string;
  tags: string[];
  embedding?: number[];
  rating: number;
  reviewsCount: number;
}

export interface Interaction {
  user: string;
  book: string;
  weight: number;
  ts: number;
}

export interface EvalUser {
  id: string;
  trainBooks: string[];
  testBooks: string[];
}

export interface Dataset {
  books: EvalBook[];
  bookById: Map<string, EvalBook>;
  catalogIds: string[];
  interactions: Interaction[];
  users: EvalUser[];
  popularityScore: Map<string, number>;
  /** bookId → (bookId → weighted co-interaction count) — item-item co-occurrence. */
  cooccurrence: Map<string, Map<string, number>>;
}

const STOPWORDS = new Set(
  "a an and are as at be by for from has he her his i in is it its of on or she that the their they this to was were will with you your".split(" ")
);

export const tokenize = (text: string): Set<string> => {
  const out = new Set<string>();
  for (const tok of text.toLowerCase().match(/[a-z0-9]{2,}/g) ?? []) {
    if (!STOPWORDS.has(tok)) out.add(tok);
  }
  return out;
};

export const bookTokenText = (b: EvalBook): string =>
  `${b.title} ${b.author} ${b.category} ${(b.tags ?? []).join(" ")}`;

export const tokenOverlap = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const tok of a) if (b.has(tok)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
};

const tokenCache = new Map<string, Set<string>>();

export const bookTokens = (b: EvalBook): Set<string> => {
  let cached = tokenCache.get(b.id);
  if (!cached) {
    cached = tokenize(bookTokenText(b));
    tokenCache.set(b.id, cached);
  }
  return cached;
};

/** Content similarity between two books: embeddings when both exist, else
 * token overlap. This keeps the "pure content-based" baseline honest even on
 * a catalog where embeddings haven't been backfilled yet. */
export const contentSimilarity = (a: EvalBook, b: EvalBook): number => {
  if (a.embedding?.length && b.embedding?.length) return cosineSimilarity(a.embedding, b.embedding);
  return tokenOverlap(bookTokens(a), bookTokens(b));
};

/** A per-user "taste profile" scorer from their training books. */
export const makeContentScorer =
  (ds: Dataset, trainIds: string[]) =>
  (bookId: string): number => {
    const candidate = ds.bookById.get(bookId);
    const trainBooks = trainIds.map((id) => ds.bookById.get(id)).filter((b): b is EvalBook => !!b);
    if (!candidate || trainBooks.length === 0) return 0;

    const vectors = trainBooks.map((b) => b.embedding).filter((e): e is number[] => !!e?.length);
    if (vectors.length > 0 && candidate.embedding?.length) {
      const dim = vectors[0].length;
      const mean = new Array(dim).fill(0);
      for (const v of vectors) for (let i = 0; i < dim; i++) mean[i] += v[i] / vectors.length;
      return cosineSimilarity(mean, candidate.embedding);
    }

    const tokens = new Set<string>();
    for (const b of trainBooks) for (const t of bookTokens(b)) tokens.add(t);
    return tokenOverlap(tokens, bookTokens(candidate));
  };

/**
 * Loads a Dataset from the connected MongoDB. Set `splitDateMs` to partition
 * interactions; pass `null` and the caller can derive a sensible split from
 * the returned interactions' timestamps instead.
 */
export const loadDataset = async (
  opts: { splitDateMs?: number | null } = {}
): Promise<Dataset> => {
  const [books, activities, orders] = await Promise.all([
    Book.find({}).select("+embedding").lean(),
    UserActivity.find({}).select("user book action weight createdAt").lean(),
    Order.find({ paymentStatus: "paid" }).select("user items createdAt").lean(),
  ]);

  const bookById = new Map<string, EvalBook>();
  for (const b of books) {
    // `.lean()` docs expose `_id` but NOT the `id` virtual — using `b.id`
    // here collapsed every book into one Map entry under `undefined`.
    const id = (b as { _id: { toString(): string } })._id.toString();
    bookById.set(id, {
      id,
      title: b.title,
      author: b.author,
      category: b.category,
      tags: b.tags ?? [],
      embedding: b.embedding?.length ? b.embedding : undefined,
      rating: b.rating ?? 0,
      reviewsCount: b.reviewsCount ?? 0,
    });
  }

  const interactions: Interaction[] = [];

  for (const a of activities) {
    if (!bookById.has(a.book.toString())) continue;
    interactions.push({
      user: a.user.toString(),
      book: a.book.toString(),
      weight: a.weight ?? 1,
      ts: new Date(a.createdAt).getTime(),
    });
  }

  for (const o of orders) {
    for (const item of o.items) {
      const bookId = (item.book as { _id?: unknown } | unknown)?.toString();
      if (!bookId || !bookById.has(bookId)) continue;
      interactions.push({
        user: o.user.toString(),
        book: bookId,
        weight: item.mode === "buy" ? 6 : 5,
        ts: new Date(o.createdAt).getTime(),
      });
    }
  }

  const booksOut = [...bookById.values()];
  let splitDateMs = opts.splitDateMs ?? null;
  if (!splitDateMs && interactions.length > 0) {
    const sorted = [...interactions].sort((x, y) => x.ts - y.ts);
    splitDateMs = sorted[Math.floor(sorted.length / 2)].ts;
  }
  return buildDataset(booksOut, interactions, splitDateMs);
};

/**
 * Pure construction of a Dataset from raw books + interactions — the single
 * place the chronological split, popularity and co-occurrence matrices are
 * computed. Used both by `loadDataset` (live DB) and by the snapshot loader
 * so `experiments/` snapshots reconstruct byte-identical datasets (§13.7).
 */
export const buildDataset = (
  books: EvalBook[],
  interactions: Interaction[],
  splitDateMs: number | null
): Dataset => {
  const bookById = new Map<string, EvalBook>(books.map((b) => [b.id, b]));

  // A null split marker means "derive it": the median interaction timestamp.
  // Doing this here (not just in loadDataset) makes snapshot reloads and live
  // loads derive the SAME split — the §13.7 reproducibility guarantee.
  let split = splitDateMs;
  if (split === null && interactions.length > 0) {
    const sorted = [...interactions].sort((x, y) => x.ts - y.ts);
    split = sorted[Math.floor(sorted.length / 2)].ts;
  }

  const trainByUser = new Map<string, Set<string>>();
  const testByUser = new Map<string, Set<string>>();
  const popularity = new Map<string, number>();

  for (const inter of interactions) {
    const isTrain = split === null || inter.ts < split;
    const bucket = isTrain ? trainByUser : testByUser;
    if (!bucket.has(inter.user)) bucket.set(inter.user, new Set());
    bucket.get(inter.user)!.add(inter.book);

    if (isTrain) {
      popularity.set(inter.book, (popularity.get(inter.book) ?? 0) + inter.weight);
    }
  }

  // Users must have both training signal AND held-out truth to be measurable.
  const users: EvalUser[] = [];
  for (const [id, trainSet] of trainByUser) {
    const testSet = testByUser.get(id);
    if (!testSet || testSet.size === 0) continue;
    users.push({ id, trainBooks: [...trainSet], testBooks: [...testSet] });
  }

  // Item-item co-occurrence over training interactions: cooccur(X,Y) is the
  // number of users who interacted with both X and Y in the train window.
  const cooccurrence = new Map<string, Map<string, number>>();
  const bookSetForUser = new Map<string, string[]>();
  for (const [userId, set] of trainByUser) bookSetForUser.set(userId, [...set]);
  for (const booksOfUser of bookSetForUser.values()) {
    for (let i = 0; i < booksOfUser.length; i++) {
      for (let j = 0; j < booksOfUser.length; j++) {
        if (i === j) continue;
        const a = booksOfUser[i];
        const b = booksOfUser[j];
        if (!cooccurrence.has(a)) cooccurrence.set(a, new Map());
        const row = cooccurrence.get(a)!;
        row.set(b, (row.get(b) ?? 0) + 1);
      }
    }
  }

  return {
    books,
    bookById,
    catalogIds: books.map((b) => b.id),
    interactions,
    users,
    popularityScore: popularity,
    cooccurrence,
  };
};

/** Deterministic PRNG so the Random baseline is reproducible (LCG). */
export const createRng = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

export const connectForScript = async (mongoUri?: string): Promise<void> => {
  const uri = mongoUri ?? process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017/lookbook";
  mongoose.set("strictQuery", false);
  await mongoose.connect(uri);
};
