# §13.1 — Research Contribution Statement

**Chosen contribution:** the **hybrid search & recommendation engine** (§3.2),
now evaluated formally and documented in depth by Phase 13.

## What is new / original in this work

1. **A hybrid retrieval pipeline composed of three signals** that a deployed
   rental library needs simultaneously:
   - *structured* — an LLM parses natural-language queries into hard filters
     (category / budget / minimum rating) that must not be overridden by
     ranking (§3.2, `aiSearchController`),
   - *content-based* — 768-d Gemini embeddings + cosine similarity for
     semantic relevance, and
   - *collaborative* — item–item co-occurrence over real interaction data,
     blended with a popularity prior for the §3.2 hybrid homepage pipeline.
   The *composition* of "LLM-parsed hard constraints + vector ranking" is the
   distinctive contribution — most systems do either keyword/vector retrieval
   OR an LLM re-ranker, not an LLM that *constrains* a vector search.

2. **A formal offline evaluation harness** (§13.2) that is reproducible and
   self-documenting: versioned anonymized dataset snapshots (§13.7), a
   chronological train/test split, five baselines plus three ablations, and
   P@K / R@K / NDCG@K / coverage / diversity — output as a run folder with
   config, CSV, JSON and dependency-free SVG plots.

3. **A lightweight online A/B experiment** (§13.3) for recommendation arms
   with a transparent two-proportion z-test report — running *inside* the
   product and in the admin UI, not in a lab.

4. **Explainability built into the serving layer** (§13.8) — every homepage
   recommendation carries a human-readable reason, and conversions are
   attributed back to the recommendation source that produced them.

## Why this, not a different topic

The thesis is an M.Tech evaluation of a *working* rental-library product. The
recommendation/search layer is where the strongest algorithmic claims live,
the data to measure them exists (interactions, paid orders), and the
evaluation artifacts (§13.2/13.3/13.4) map 1:1 onto a defendable evaluation
chapter. Alternative topics (performance tuning, UX, deployment) were judged
harder to quantify and less novel.

## Evidence produced by this layer

| Claim | Evidence |
|---|---|
| Hybrid beats individual signals offline | `experiments/<run-id>/report.md` (§13.2) |
| Arm experiment is measurable online | `GET /api/admin/analytics/ab-report` + admin UI (§13.3) |
| Latency grows predictably with catalog size | `experiments/benchmark/vector-latency-*.json` (§13.4.3) |
| Index coverage is verifiable | `experiments/benchmark/query-plans-*.md` (§13.4.2) |
| Provider choice is a config, not a rewrite | `npm run eval:llm` (§13.9) |

## Limitations (candidate for future work)

- Offline eval uses recorded interactions as ground truth; implicit-feedback
  bias is not fully corrected (popularity-bias correction is future work).
- The online experiment's conversion window is per-session; long-tail
  purchases after session end are missed.
- Embedding model is a black box (Gemini); no fine-tuning/ablation of the
  embedding model itself was performed.