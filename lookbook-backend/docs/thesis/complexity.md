# §13.6.5 — Complexity Analysis

Big-O analysis of the algorithms the evaluation layer measures. `n` = catalog
size, `m` = user's interaction history, `d` = embedding dimensionality.

## Recommendation pipeline (§3.2 hybrid)

| Stage | Complexity | Notes |
|---|---|---|
| Embedding lookup (DB) | O(1) per book (stored field) | Mongo doc read |
| Vector similarity scan (in-process fallback) | O(n·d) | `findSimilarByVector` cosine-scan; the measured §13.4.3 bottleneck |
| Atlas `$vectorSearch` | ~O(log n) ANN | HNSW/IVF in Atlas; reported best-effort |
| Item-item co-occurrence build (offline, per train set) | O(Σ interactions) | Single pass over the interaction log |
| Hybrid scoring (online, per user) | O(m·k + n) | content scores for candidate set, collab from m co-occurrence rows, popularity prior |
| Overall online serve | O(n·d) worst case | dominated by the cosine scan when Atlas vector search is unavailable |

## AI search

| Stage | Complexity | Notes |
|---|---|---|
| Query parse | O(1) LLM call | network-bound, not CPU |
| Hard-filter query | O(log n) · result set | indexed filters (category/price/rating) |
| Cosine re-rank within qualifying set | O(c·d) where c ≪ n | c = qualifying books |
| Total | O(c·d + LLM) | LLM latency dominates (§13.9 measures it) |

## Analytics & evaluation

| Stage | Complexity | Notes |
|---|---|---|
| Funnel aggregation | O(E) over window | one Mongo aggregation pass over events |
| AB report (`computeAbReport`) | O(E) | single pass; sessions/books in hashmaps |
| Offline metrics (P@K, R@K, NDCG@K, coverage, diversity) | O(T·K) per strategy | T = test interactions, K = 5/10 |
| Recommendation generation during eval | same as online + per-user rebuild | strategies are pure functions over the Dataset |

## Space

- Embedding storage: O(n·d) floats (~3.1 MB / 1k books at 768-d).
- Offline Dataset: O(n·d + interactions) with `bookById`/`cooccurrence` maps.
- AB report: O(unique sessions × clicked books).

## Practical takeaway

The only super-linear hot path is the in-process cosine scan (§13.4.3). It is
the reason the production path prefers Atlas `$vectorSearch`, and the reason
the thesis should quote the measured latency curve (1k → 10k → 50k) rather
than an asymptotic claim.