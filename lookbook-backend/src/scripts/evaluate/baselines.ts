import type { Dataset, EvalUser } from "./dataset";
import { contentSimilarity, createRng, makeContentScorer } from "./dataset";

/**
 * §13.2 recommendation baselines. Each `RecommendationStrategy` returns a
 * ranked list of catalog bookIds for a user, given only their training
 * interactions. Training books are always excluded from candidates so a
 * "repeated the same book" shortcut can't inflate any baseline.
 *
 * Baselines: random, popularity, pure content-based, pure collaborative,
 * and the §3.2 hybrid (the real production pipeline, approximated offline).
 * The hybrid's ablations (drop one component at a time) are also exposed here.
 */

export type RecommendFn = (user: EvalUser, limit: number) => string[];

const candidatesFor = (ds: Dataset, user: EvalUser): string[] => {
  const train = new Set(user.trainBooks);
  return ds.catalogIds.filter((id) => !train.has(id));
};

/** Random — lower bound, reproducible via seeded RNG. */
export const randomStrategy = (ds: Dataset, seed = 42): RecommendFn => {
  const rng = createRng(seed);
  return (user, limit) => {
    const pool = candidatesFor(ds, user);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, limit);
  };
};

/** Popularity — global most-interacted books in train; identical list for everyone. */
export const popularityStrategy = (ds: Dataset): RecommendFn => {
  const ranked = [...ds.popularityScore.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  return (user, limit) => {
    const train = new Set(user.trainBooks);
    return ranked.filter((id) => !train.has(id)).slice(0, limit);
  };
};

/** Pure content-based — nearest neighbors of the user's averaged taste vector
 * (embedding space, falling back to token overlap when embeddings are absent). */
export const contentStrategy = (ds: Dataset): RecommendFn => {
  return (user, limit) => {
    const scorer = makeContentScorer(ds, user.trainBooks);
    return candidatesFor(ds, user)
      .map((id) => ({ id, score: scorer(id) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.id);
  };
};

/** Pure collaborative — item-item co-occurrence from training interactions only. */
export const collaborativeStrategy = (ds: Dataset): RecommendFn => {
  return (user, limit) => {
    const train = new Set(user.trainBooks);
    const scores = new Map<string, number>();
    for (const trainBook of user.trainBooks) {
      const row = ds.cooccurrence.get(trainBook);
      if (!row) continue;
      for (const [candidate, weight] of row) {
        if (train.has(candidate)) continue;
        scores.set(candidate, (scores.get(candidate) ?? 0) + weight);
      }
    }
    return [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
  };
};

const normalize = (scores: Map<string, number>): Map<string, number> => {
  let max = 0;
  for (const v of scores.values()) max = Math.max(max, v);
  if (max === 0) return scores;
  const out = new Map<string, number>();
  for (const [k, v] of scores) out.set(k, v / max);
  return out;
};

/**
 * The §3.2 hybrid, approximated offline: content similarity (vector) blended
 * with collaborative co-occurrence and a popularity prior, mirroring the
 * production pipeline's structured-filter + vector + re-rank composition.
 * `weights` configures the blend and powers the ablation study.
 */
export const hybridStrategy = (
  ds: Dataset,
  weights: { content: number; collaborative: number; popularity: number }
): RecommendFn => {
  const popMax = Math.max(0, ...[...ds.popularityScore.values()]);
  return (user, limit) => {
    const scorer = makeContentScorer(ds, user.trainBooks);
    const train = new Set(user.trainBooks);

    const collab = new Map<string, number>();
    for (const trainBook of user.trainBooks) {
      const row = ds.cooccurrence.get(trainBook);
      if (!row) continue;
      for (const [candidate, w] of row) {
        if (train.has(candidate)) continue;
        collab.set(candidate, (collab.get(candidate) ?? 0) + w);
      }
    }
    const normContent = normalize(new Map(candidatesFor(ds, user).map((id) => [id, scorer(id)])));
    const normCollab = normalize(collab);

    const total = new Map<string, number>();
    const all = new Set([...normContent.keys(), ...normCollab.keys()]);
    for (const id of all) {
      const pop = popMax > 0 ? (ds.popularityScore.get(id) ?? 0) / popMax : 0;
      total.set(id, weights.content * (normContent.get(id) ?? 0) + weights.collaborative * (normCollab.get(id) ?? 0) + weights.popularity * pop);
    }
    return [...total.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
  };
};

/** The production-approximate hybrid with default weights (§13.2 baseline). */
export const defaultHybrid = (ds: Dataset): RecommendFn =>
  hybridStrategy(ds, { content: 0.5, collaborative: 0.3, popularity: 0.2 });

/** Ablations of the hybrid — remove one component at a time (§13.2 step 4). */
export const ablationStrategies = (ds: Dataset): { label: string; fn: RecommendFn }[] => [
  { label: "hybrid-no-content", fn: hybridStrategy(ds, { content: 0, collaborative: 0.6, popularity: 0.4 }) },
  { label: "hybrid-no-collaborative", fn: hybridStrategy(ds, { content: 0.7, collaborative: 0, popularity: 0.3 }) },
  { label: "hybrid-no-popularity", fn: hybridStrategy(ds, { content: 0.6, collaborative: 0.4, popularity: 0 }) },
];

export const allStrategies = (ds: Dataset): { label: string; fn: RecommendFn }[] => [
  { label: "random", fn: randomStrategy(ds) },
  { label: "popularity", fn: popularityStrategy(ds) },
  { label: "content-based", fn: contentStrategy(ds) },
  { label: "collaborative", fn: collaborativeStrategy(ds) },
  { label: "hybrid", fn: defaultHybrid(ds) },
  ...ablationStrategies(ds),
];

export const similarityFor = (ds: Dataset) => (a: string, b: string): number => {
  const A = ds.bookById.get(a);
  const B = ds.bookById.get(b);
  if (!A || !B) return 0;
  return contentSimilarity(A, B);
};