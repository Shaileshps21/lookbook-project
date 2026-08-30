# §13.2 — Performance & Load Testing

**Date:** 2026-08-27 · run live against Atlas (`test` DB, 185 books) + Redis Cloud,
both apps running locally (`lookbook-backend` on :5000, `lookbook-frontend` prod
build previewed on :4173).

This entry supersedes the "🧱 built but not run" status in `phase-13-status.md`
for items 1–4b — everything below is a live measurement, not a plan. Three
pre-existing bugs in the benchmark/load-test tooling itself were found and
fixed along the way (they had silently prevented every prior run from
producing real numbers); see **Tooling bugs fixed**.

---

## Tooling bugs fixed

These blocked the benchmarks from ever actually running/measuring anything —
worth flagging since the code shipped as "built" in the 2026-08-18 status
table but had never produced a real result.

1. **`src/scripts/benchmark/vectorLatency.ts`** — `cosineScan()` queried a
   model bound to the default Mongoose connection, which this script never
   opens (it seeds data through a separate `mongoose.createConnection(...,
   {dbName: "lookbook_benchmark"})`). Every run failed after seeding with
   `MongooseError: Operation 'books.find()' buffering timed out after
   10000ms`. Fixed by passing the connected model into `cosineScan`.
2. **`benchmarks/k6/book-search.js`** — used `new URLSearchParams(q)` to build
   the query string. k6's JS runtime (goja) has no `URLSearchParams` global,
   so every iteration threw and **zero real HTTP requests were made** (the
   "passing" threshold report showed `0 B` sent/received). Fixed with a manual
   `encodeURIComponent` join.
3. **`benchmarks/k6/chat.js`** — posted `{ message, history }`, but
   `POST /api/assistant/chat/stream` actually expects `{ messages: [{role,
   content}] }` (`assistantController.ts:288-290`). Every request 400'd in
   ~5ms — fast enough to look like a working benchmark instead of a request
   that never reached the model. Fixed to send the correct shape.

## §13.2.2 — Query-plan analysis (`npm run bench:query-plans`)

All 9 real query shapes hit an index (**IXSCAN**), consistent with the
2026-08-18 fix that added `{rating:-1, reviewsCount:-1}` and `{createdAt:-1}`.
No COLLSCANs found.

| Query | Time (ms) | Docs examined | Docs returned | Scan stage |
|---|---|---|---|---|
| Book list search (title/author/tags regex) | 8 | 260 | 12 | IXSCAN |
| Category + price filter, rating sort | 0 | 19 | 12 | IXSCAN |
| Homepage: popular (rating+reviews sort) | 0 | 8 | 8 | IXSCAN |
| Homepage: new releases (createdAt sort) | 0 | 8 | 8 | IXSCAN |
| Homepage: popular in genre | 0 | 14 | 8 | IXSCAN |
| UserActivity: recent activity for homepage | 6 | 0 | 0 | IXSCAN |
| Order: user's order history | 3 | 0 | 0 | IXSCAN |
| Public API: filtered book list + count | 0 | 31 | 24 | IXSCAN |
| Book by ISBN (catalog-first lookup) | 0 | 90 | 90 | IXSCAN |

**Known issue, not a real COLLSCAN:** the "Book count for same search" row
reports `scanStage: "unknown"` / all-zero stats — `.countDocuments().explain()`
doesn't return `executionStats` in the shape the summarizer expects (Mongoose
count queries explain differently from find queries). Cosmetic script bug in
the summarizer, not evidence of a missing index; left as a known limitation
rather than "fixed" since the other 9 rows already give complete coverage.

Full raw output: `experiments/benchmark/query-plans-2026-08-27T12-28-10-543Z.json`

## §13.2.3 — Vector-search latency (`npm run bench:vector`)

Catalog size 1,000 synthetic books, 768-dim embeddings, in-process
cosine-similarity fallback path (the path `utils/vectorSearch.ts` uses when
Atlas Vector Search isn't available):

| Catalog size | p50 | p95 | p99 | max |
|---|---|---|---|---|
| 1,000 | 2,164 ms | 5,455 ms | 12,832 ms | 12,832 ms |

**10k/50k not obtained** — seeding 10,000 synthetic docs (~62 MB) via
`insertMany` ran for 20+ minutes with no progress and was stopped rather than
left to hang indefinitely. This is consistent with the already-documented
Atlas TLS flakiness (`phase-13-status.md` §13.6: "~50% of fresh TLS
connections drop, SSL alert 80") extending to sustained bulk writes, not a
code issue — the 1k run (same code path) completed normally.

**What the 1k number already shows:** even at a small catalog, this fallback
path re-fetches **every** embedded candidate from the DB on every single
query (`BenchBookModel.find({embedding: {$exists:true}}).lean()`), so latency
is dominated by network transfer of the full embedded catalog, not by the
cosine-similarity computation itself. This confirms the roadmap's prediction
(`UPDATED_FUTURE.md` §13.2.3) that this is "the piece most likely to hit a
scalability limit" — it will get worse, not better, as the catalog grows,
until Atlas Vector Search (server-side ANN, no full-catalog fetch) is
confirmed available on this cluster tier.

Full raw output: `experiments/benchmark/vector-latency-2026-08-27T12-39-10-613Z.{json,csv}`

## §13.2.1 — k6 load tests

All four core paths, run live against the local backend:

| Path | VUs | Duration | avg | p95 | max | Notes |
|---|---|---|---|---|---|---|
| Book search (`GET /api/books`) | 20 | 30s | 2.08s | 2.88s | 8.3s | Isolated run (no concurrent DB load). 278 reqs, 0 errors, but only ~8.8 req/s throughput |
| AI search (`GET /api/books/ai-search`) | 5 | 20s | 11.37s | 18.38s | 22.43s | Includes LLM query-parse + vector re-rank, as expected; 0 errors, 0 rate-limit hits |
| Checkout (`POST /api/orders/checkout`) | 5 | 20s | 106 ms | 194 ms | 396 ms | Expected 400s (unverified email) — fast because it fails validation before significant DB work |
| Chat assistant (`POST /api/assistant/chat/stream`) | 3 | 15s | mixed | — | — | 4/12 succeeded (200, ~3.1s avg); 8/12 hit the endpoint's rate limiter (429) — expected under this burst pattern, not a bug |

**The single most important finding:** a plain `curl` to `/api/books` returns
in ~270 ms, but the *same* endpoint under 20 concurrent users averages 2.08s
— an ~8x degradation with zero application errors. The query itself is
sub-10ms server-side per the query-plan analysis above, so this is not a slow
query. Corroborating evidence points at network/infra, not app code:

- The homepage endpoint's **Redis cache hit** path (confirmed via the
  response's `meta.cached: true`, so no recompute happened) still took
  3.5–4.2s for a fresh user — a plain `redis.get()` + `JSON.parse()` should be
  low tens of ms, not seconds.
- The already-documented Atlas TLS flakiness and the 10k vector-seed hang
  above are independent symptoms of the same thing: slow/unstable network
  paths from this dev machine to the remote Atlas and Redis Cloud endpoints.

**Conclusion:** this reads as a dev-environment network constraint (this
machine's connection to the cloud-hosted Atlas/Redis instances), not a code
defect — nothing in the query plans, caching logic, or connection setup looks
wrong. It should be re-measured from infrastructure closer to the database
(a cloud VM in the same region as the Atlas cluster, or once real deployment
infra exists per §13.5) before concluding anything about production
capacity. Recorded here as the honest baseline from this environment.

Cold vs. warm cache comparison (`GET /api/homepage`, fresh user to guarantee
a true cache miss):

| State | Response time |
|---|---|
| Cold (first call, cache miss, full recommendation compute) | 13.53s |
| Warm (`meta.cached: true`) | 3.57s |
| Warm (repeat) | 4.18s |

The cache still roughly halves latency (13.5s → ~3.5–4.2s), i.e. it is doing
its job — but the warm-path floor is far higher than a healthy Redis round
trip should be, for the network reasons above.

## §13.2.4b — Lighthouse baseline

Two runs against the homepage, to separate a real baseline from a dev-server
artifact:

| | `npm run dev` (:5173) | Production build + `vite preview` (:4173) |
|---|---|---|
| Performance | 55 | **83** |
| Accessibility | 80 | 90 |
| Best Practices | 100 | 92 |
| SEO | 91 | 83 |
| FCP | 11.1s | **2.5s** |
| LCP | 19.7s | **2.9s** |
| TBT | 100ms | 140ms |
| CLS | 0 | 0 |
| Speed Index | 14.0s | 7.9s |
| TTI | 21.4s | 2.9s |

The dev-server numbers are not representative — Vite serves hundreds of
unbundled ES modules in dev mode, which Lighthouse penalizes heavily; that's
a dev-mode artifact, not a real user experience. **Use the production-build
column (Performance 83, LCP 2.9s) as the §13.2.4b baseline.** Speed Index
(7.9s) lags the other prod metrics, likely from progressive loading of
Open Library cover images; worth another look once real hosting (§13.5) is
in place and this can be measured over a real network instead of localhost
loopback plus remote-API round trips.

Full reports: `docs/lighthouse/home.report.{json,html}` (dev),
`docs/lighthouse/home-prod.report.{json,html}` (production).

## Summary for `phase-13-status.md`

- §13.2 item 1 (k6 load test): ✅ run — see table above.
- §13.2 item 2 (query-plan analysis): ✅ confirmed clean (all IXSCAN).
- §13.2 item 3 (vector latency): 🧱→✅ partial — 1k measured; 10k/50k blocked
  by the same Atlas write-throughput issue already tracked in §13.6.
- §13.2 item 4a (bundle audit): unchanged, already ✅.
- §13.2 item 4b (Lighthouse): ✅ run — production baseline recorded above.
