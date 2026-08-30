/**
 * §13.2 offline evaluation metrics. All are computed per user against the
 * held-out (post-T) interactions and then averaged, per future.md's spec:
 * Precision@K, Recall@K, NDCG@K, catalog coverage, and list diversity.
 */

export const precisionAtK = (recs: string[], relevant: Set<string>, k: number): number => {
  const hits = recs.slice(0, k).filter((id) => relevant.has(id)).length;
  return k > 0 ? hits / k : 0;
};

export const recallAtK = (recs: string[], relevant: Set<string>, k: number): number => {
  if (relevant.size === 0) return 0;
  const hits = recs.slice(0, k).filter((id) => relevant.has(id)).length;
  return hits / relevant.size;
};

export const ndcgAtK = (recs: string[], relevant: Set<string>, k: number): number => {
  const topK = recs.slice(0, k);
  let dcg = 0;
  for (let i = 0; i < topK.length; i++) {
    if (relevant.has(topK[i])) dcg += 1 / Math.log2(i + 2);
  }
  const ideal = Math.min(relevant.size, k);
  let idcg = 0;
  for (let i = 0; i < ideal; i++) idcg += 1 / Math.log2(i + 2);
  return idcg > 0 ? dcg / idcg : 0;
};

/** Fraction of the catalog ever recommended across all users (over-concentration guard). */
export const coverage = (allRecs: string[][], catalogSize: number): number => {
  if (catalogSize === 0) return 0;
  const distinct = new Set<string>();
  for (const recs of allRecs) for (const id of recs) distinct.add(id);
  return distinct.size / catalogSize;
};

/** Average pairwise dissimilarity within each recommendation list (1 − similarity). */
export const diversity = (
  allRecs: string[][],
  similarity: (a: string, b: string) => number
): number => {
  let total = 0;
  let pairs = 0;
  for (const list of allRecs) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const sim = Math.min(1, Math.max(0, similarity(list[i], list[j])));
        total += 1 - sim;
        pairs++;
      }
    }
  }
  return pairs > 0 ? total / pairs : 0;
};

export interface StrategyMetrics {
  strategy: string;
  precisionAtK: number;
  recallAtK: number;
  ndcgAtK: number;
  coverage: number;
  diversity: number;
  evaluatedUsers: number;
}

export const evaluateStrategy = (
  strategy: string,
  recsByUser: string[][],
  relevantByUser: Set<string>[],
  catalogSize: number,
  k: number,
  similarity: (a: string, b: string) => number
): StrategyMetrics => {
  const n = recsByUser.length;
  let p = 0;
  let r = 0;
  let ndcg = 0;
  for (let i = 0; i < n; i++) {
    p += precisionAtK(recsByUser[i], relevantByUser[i], k);
    r += recallAtK(recsByUser[i], relevantByUser[i], k);
    ndcg += ndcgAtK(recsByUser[i], relevantByUser[i], k);
  }
  return {
    strategy,
    precisionAtK: n > 0 ? p / n : 0,
    recallAtK: n > 0 ? r / n : 0,
    ndcgAtK: n > 0 ? ndcg / n : 0,
    coverage: coverage(recsByUser, catalogSize),
    diversity: diversity(recsByUser, similarity),
    evaluatedUsers: n,
  };
};