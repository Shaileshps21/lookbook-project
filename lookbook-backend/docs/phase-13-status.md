# Phase 13 — Status Tracker (per `UPDATED_FUTURE.md` Part B)

**Last updated:** 2026-08-27 (§13.5 re-verification)

Status legend: ✅ done · 🧱 built but not runnable here · ⏸ blocked on infra/user · ⏳ deferred.

## §13.1 Recommendation Experimentation Infrastructure

| Item | Status | Evidence |
|---|---|---|
| `User.recommendationArm` (persistent, no schema default, lazily randomized) | ✅ | `models/User.ts`, `homepageController.ts:ensureArm` |
| `GEMINI_TEXT_MODEL` env var (model swappable without redeploy) | ✅ | `config/env.ts`, `utils/ai.ts` |
| Homepage A/B arms (hybrid vs popularity from same endpoint) | ✅ | `homepageController.ts`, `utils/recommendations.ts` |
| Explainability reasons ("why" tags on each recommended book) | ✅ | homepage payload `reasons`, frontend `BookCard` badge |
| Analytics events tagged with serving arm | ✅ | `utils/analytics.ts` (`recommendation_view`, `recommendation_click`), frontend `BookRow`/`BookCard` |
| AB report endpoint (admin aggregation, CTR/conversion per arm, z-test) | ✅ | `utils/abStats.ts`, `analyticsController.ts`, verified against synthetic events |
| **Admin UI panel for the AB report** | ✅ | `ProductAnalyticsPanel.tsx` (AB table + TestVerdict), `adminService.fetchAbReport` |
| Decide whether arm assignment needs frontend awareness | ✅ | Decision recorded in `docs/thesis/design-decisions.md` (§13.1 section): transparent serving, frontend only tags events |
| Run over a real usage window before drawing conclusions | ⏸ | Needs live traffic; nothing to do in-repo. Deferred until §13.5.1 infra exists |

## §13.2 Performance & Load Testing

| Item | Status | Evidence |
|---|---|---|
| 1. Load test core read/write paths with k6 (p50/p95/p99, cold vs warm cache) | ✅ | Ran live 2026-08-27 against all 4 paths (book search, AI search, checkout, chat) — `docs/thesis/performance-load-testing.md`. Found & fixed 2 broken scripts (`URLSearchParams` not in k6's runtime; chat script sent the wrong request shape) that had silently produced zero-signal "passing" runs before |
| 2. Query plan analysis `.explain("executionStats")` on top-5 heaviest queries | ✅ | Ran live on Atlas (`bench:query-plans`, 2026-08-18; re-confirmed 2026-08-27). Found COLLSCANs on homepage `popular`/`new releases`; fixed with indexes on `Book.rating`+`Book.reviewsCount` and `Book.createdAt`; re-run confirms all IXSCAN (examined 185→8) |
| 3. Vector search latency at 1k/10k/50k synthetic books | 🧱→✅ partial | Fixed a model-binding bug that made every prior run fail (`docs/thesis/performance-load-testing.md`). 1k measured live (p50 2.16s, p95 5.46s); 10k/50k still blocked by Atlas write-throughput (20+min hang on a 10k `insertMany`, consistent with the TLS flakiness in §13.6) |
| 4a. Bundle/asset audit | ✅ | `docs/bundle-audit.md` — main bundle 620→420 kB (gz 176→132); route-level code splitting; `react-icons` removed |
| 4b. Lighthouse baseline on home/search/checkout | ✅ | Ran live 2026-08-27 against a production build (`vite preview`), not just dev mode — Performance 83, LCP 2.9s. See `docs/thesis/performance-load-testing.md` |

## §13.3 Security Review

| Item | Status | Evidence |
|---|---|---|
| 1. OWASP Top 10 (2021) pass — risk → mitigation → residual risk table | ✅ | `docs/thesis/owasp-checklist.md`; re-verified live 2026-08-27 (raw-body webhook signing, `sanitizeUser` allowlisting, and the auth rate limiter all exercised, not just read) |
| 2. Dependency audit (npm audit, both apps) | ✅ | `docs/thesis/dependency-audit.md`; backend `nodemailer` 6→9 fixed; frontend now 0 vulns; 2 dev-only high (eslint toolchain) documented + dated; re-ran 2026-08-27, identical counts (no drift) |
| 3. Secrets hygiene | ✅ | `.env.example` scrubbed of all real values (2026-08-18); repo-wide scan finds no hardcoded credentials outside `.env`; repo is not under git, so no committed-history exposure to audit; re-scanned 2026-08-27 (source files + docker-compose.yml + all `.env*` file locations), still clean |

## §13.4 Architecture Documentation & Design-Decision Log

| Item | Status | Evidence |
|---|---|---|
| Component/deployment diagram | ✅ | `docs/thesis/architecture.md`; re-verified 2026-08-27, fixed "React 18"→19 and a fabricated `safeCache`/TTL-jitter claim that didn't match `config/redis.ts` |
| ER diagram | ✅ | `docs/thesis/er-diagram.md`; re-verified 2026-08-27 against all 22 real model files — added 2 missing collections (`Plan`, `Shelf`), corrected 3 entities (`WISHLIST_ITEM`/`MEMBERSHIP`/`ADMIN_USER`) that didn't correspond to any real collection |
| Sequence diagrams (checkout+webhook, hybrid search/recommendation, …) | ✅ | `docs/thesis/sequence-diagrams.md`; re-verified 2026-08-27 — the checkout diagram was significantly wrong (showed a single synchronous call decrementing stock inline) vs. the real code's split of order-creation/payment-verification/webhook around one idempotent `finalizePaidOrder`; rewritten to match. AI-search and recommendation diagrams checked out accurate as-is |
| Design-decision log incl. the 5 required platform decisions | ✅ | `docs/thesis/design-decisions.md` (D1–D11 + "Platform design decisions" table); re-read 2026-08-27, holds up, no changes needed |

## §13.5 Deployment & Reproducibility

| Item | Status | Evidence |
|---|---|---|
| 1. Verify Docker + CI on real infra | ⏸→🧱 substituted | Still no Docker daemon / git remote here (2026-08-27, unchanged). Substitute verification done instead: both Dockerfiles + `.dockerignore` reviewed line-by-line (build stages match `tsconfig.json` outDir, `CMD` matches `start` script, `.env` correctly excluded from build context — no secrets-leak risk); every CI workflow step (`lint`, `tsc`, `test`) run locally exactly as written for both apps — all pass (backend: lint 0 errors/5 warnings, tsc clean, Jest 26/26; frontend: lint clean, tsc clean, Vitest 14/14). Confirms the workflow is correct, not just present. Actually triggering `docker compose up --build` and a real CI push still needs real infra |
| 2. Setup-from-scratch doc | ✅ | `docs/setup-from-scratch.md`; re-verified 2026-08-27 — `npm run seed`'s claimed behavior (`deleteMany`+`insertMany` on Book/Category/Plan, demo admin upsert) confirmed against `seed.ts` source; §5 updated to reflect the Lighthouse baseline now being done and the CI-steps-verified-locally substitute above |
| 3. Seed-data versioning | ✅ | Deterministic fixtures `src/data/*` + `npm run export:dataset` JSON snapshot (see setup doc §3); re-ran live 2026-08-27 — 185 books/99 interactions/28 users, confirms still working (interaction/user counts grew from 72/21 on 2026-08-18 from intervening verification traffic) |

## §13.6 Resolve Environment/Credential Gaps

Current state per §A.13 (unchanged unless noted; all user-side):

| Credential | Status |
|---|---|
| **Cloudinary** | Key/secret present in `.env`; API reachability not verified from this machine |
| **Groq** | `GROQ_API_KEY` returns 401 (invalid credential) — must be regenerated in the Groq console; AI features fall back to Gemini meanwhile (`utils/ai.ts` is provider-agnostic) |
| **Gemini** | Key present; used as the active AI provider (embeddings + text) |
| **Redis** | Reachable per config; optional at runtime |
| **MongoDB Atlas** | ⚠️ **2026-08-28 root cause:** the recurring `SSL alert number 80` / `MongoServerSelectionError` is **Atlas refusing a non-allowlisted IP**, not a TLS/transport fault — the driver just reports the refused handshake. This machine's public IP is dynamic (`152.59.184.36` on 08-18 → `152.59.185.197` on 08-28), so it silently breaks a working setup. Fix: add the current IP under Atlas → Network Access. This also explains the "~50% of fresh connections drop" note below (established connections survived; new ones were refused). Earlier notes: IP 152.59.184.36 whitelisted 2026-08-18. Live eval/benchmark/import runs now possible. Residual flakiness: ~50% of *fresh* TLS connections drop (`SSL alert number 80`); retry boot until connected, established connections are stable. Large sustained writes now confirmed to hang, not just time out: 2026-08-27, a 10k-doc `insertMany` (~62MB) ran 20+ minutes with zero progress and was stopped manually. Also observed 2026-08-27: even confirmed Redis cache-hit reads (`meta.cached:true`) took 3.5–4.2s and simple indexed Mongo queries averaged 2s+ under just 20 concurrent requests — points at this dev machine's network path to the cloud services, not app code (see `docs/thesis/performance-load-testing.md`) |

Nothing in §13.6 blocks §13.1–13.5; it is tracked here so a reviewer trying the
app fresh knows which external services are expected to be live.

## Suggested-order follow-ups (outside-repo)

1. ✅ Atlas IP whitelisted (2026-08-18) — `bench:query-plans`, `export:dataset`, `eval:recommendations`, `eval:ab` all ran live (results in `experiments/`).
2. Regenerate `GROQ_API_KEY` → `npm run eval:llm` for the provider comparison (current key returns 401).
3. Docker host + git remote → §13.5.1 and the Lighthouse baseline (§13.2.4b).
4. Retry `bench:vector` from a network with stable TLS to Atlas (1k/10k/50k synthetic-book latency).

## 2026-08-27 §13.5 deployment & reproducibility re-verification

No Docker daemon or git remote in this environment (same blocker as
2026-08-18) — the user will deploy separately. Rather than leave §13.5.1
untouched, did the closest available substitute:

- **Dockerfiles reviewed line-by-line**: backend build stage → `outDir:
  "dist"` in `tsconfig.json` matches `COPY --from=builder /app/dist`;
  `CMD ["node", "dist/server.js"]` matches the `start` script. Frontend
  build → nginx stage copies `dist` + a hand-written `nginx.conf` with a
  correct SPA `try_files` fallback. Both `.dockerignore` files exclude
  `.env`/`node_modules`/`dist`/`.git` — no secrets-leak risk into build
  layers.
- **Every CI workflow step run locally**, exactly as `.github/workflows/
  ci.yml` defines them (skipped only `npm ci` itself, to avoid wiping
  `node_modules` out from under the running dev servers): backend
  `npm run lint` (0 errors/5 known warnings), `tsc --noEmit` (clean),
  `npm test` (Jest 26/26); frontend `npm run lint` (clean), `tsc -b`
  (clean), `npm test` (Vitest 14/14). This confirms the workflow would
  actually pass if triggered — the only real gap is a git remote to push to.
- **Confirmed backend tests are fully self-contained**: `globalSetup.ts`
  spins up `mongodb-memory-server` and explicitly zeroes `REDIS_URL` before
  any test runs, so CI needs no service containers or secrets for `npm
  test` to work — a real positive finding, not just documentation.
- **`setup-from-scratch.md`**: `npm run seed`'s documented behavior verified
  against `seed.ts` source (matches exactly); stale §5 updated — Lighthouse
  is now done (was "pending"), and the Docker/CI substitute work above
  added in place of the old blanket "not verified" note.
- **Seed-data versioning**: re-ran `npm run export:dataset` live (read-only,
  safe) — 185 books/99 interactions/28 users, still works correctly.

## 2026-08-27 §13.4 architecture docs re-verification

The 4 architecture docs were marked ✅ from 2026-08-18; each was checked
against the actual code rather than assumed current — same discipline as
§13.2/§13.3 the same day. Two of the four had real drift:

- **ER diagram**: cross-checked all 22 real model files. `models/Plan.ts`
  and `models/Shelf.ts` are genuine standalone collections that were
  completely absent from the diagram. Conversely, `WISHLIST_ITEM`,
  `MEMBERSHIP`, and `ADMIN_USER` were drawn as if they were separate
  collections — they're actually an embedded `Book` id array on `User`, an
  embedded `User` id array on `Club`, and a `role` enum value on `User`,
  respectively (verified by reading each model file). Fixed: added the two
  missing entities, corrected the three misrepresented ones, documented the
  reasoning inline so it doesn't drift back silently.
- **Architecture doc**: said "React 18" (actual: 19, confirmed from
  `package.json`) and described a `safeCache` in-memory-Map fallback plus
  "hot-key TTL jitter" for the Redis cache — neither exists anywhere in
  the code (`grep -rn "safeCache\|jitter" src/` found nothing).
  `config/redis.ts` is actually much simpler: every cache call is
  try/catch-wrapped and checks `redis.status === "ready"`, so an
  unreachable Redis just means requests fall through to a live recompute,
  no fallback cache. Both corrected.
- **Sequence diagrams**: the checkout diagram (#3) was significantly
  inaccurate — it showed one synchronous call that decremented stock
  inline. The real code (`orderController.ts`) deliberately splits order
  creation (`checkout`, `paymentStatus: pending`) from payment confirmation
  (`verifyPayment` and the Razorpay/Stripe webhook handlers), both
  converging on one idempotent `finalizePaidOrder` — explicitly commented
  in the source as "never trust a client 'it succeeded' claim." Rewritten
  to show the real split, including the webhook path the roadmap
  specifically asked for and that no existing diagram had. Also noted: the
  webhook path is unexercised in this environment (providers can't reach
  `localhost`), called out explicitly rather than left implicit. The
  AI-search and recommendation-serving diagrams were checked against
  `aiSearchController.ts`/`homepageController.ts` and hold up unchanged.
- **Design-decision log**: re-read in full, all 5 required platform
  decisions present and accurate, no changes needed.

## 2026-08-27 §13.3 security review re-verification

The 2026-08-18 security docs were re-checked live rather than trusted as-is
(the §13.2 pass the same day found docs claiming "built"/"done" work that had
never actually run — same discipline applied here):

- **Dependency audit**: re-ran `npm audit --json` on both apps. Backend: 2
  high, dev-only (`brace-expansion`, `js-yaml` via the eslint toolchain) —
  identical to 2026-08-18. Frontend: 0 vulnerabilities — unchanged. No drift.
- **Secrets hygiene**: re-scanned all backend/frontend source files for
  hardcoded-credential patterns (AWS keys, private-key blocks, live Stripe/
  Razorpay keys, Google API keys, Groq keys, `mongodb(+srv)://user:pass@`)
  — none found. Confirmed the only `.env*` files in the repo are the 4
  expected ones (`{backend,frontend}/.env{,.example}`); `.env.example`
  re-read end to end, still all placeholders. `docker-compose.yml` uses
  `env_file:`, no inline secrets.
- **OWASP checklist**: spot-verified 4 claims against running code/live
  traffic instead of re-reading the table: (1) `express.json({verify})`
  correctly preserves raw bytes for Razorpay/Stripe HMAC verification —
  the common bug of re-serializing the parsed body before checking the
  signature is not present; (2) `sanitizeUser` allowlists fields rather than
  spreading the raw `User` doc, so `password`/`refreshTokens` can't leak by a
  future field addition; (3) CSRF middleware and per-route rate limiters are
  actually wired into `routes/*`, not just present in `middleware/`; (4) hit
  `POST /api/auth/login` 25× rapidly — got `401` ×20 then `429` from request
  21 on, confirming the rate limiter fires in practice, not just in code.
- **Result**: all three §13.3 items hold up unchanged. No new vulnerabilities,
  no secrets found, no gap between the documented controls and the running
  app. The doc's "Open items" (dev-toolchain major bump for the 2 remaining
  high vulns, fuzz-testing the image-upload gate / CSV import, stricter
  webhook content-type assertion) remain open and undecided — flagged for the
  user rather than acted on unilaterally, since the original doc explicitly
  called the toolchain bump "a separate, risk-controlled change."

## 2026-08-27 §13.2 performance & load-testing run

Full write-up: `docs/thesis/performance-load-testing.md`. Short version:

- **3 tooling bugs found & fixed** that had prevented every prior §13.2 run
  from producing a real number: `vectorLatency.ts` queried an unconnected
  Mongoose model (always timed out after seeding); `book-search.js` used
  `URLSearchParams`, which doesn't exist in k6's JS runtime (every iteration
  threw, zero requests sent, but thresholds still reported "passing" on zero
  data); `chat.js` posted the wrong request shape and was measuring 400
  responses, not the chat path.
- **Query-plan analysis**: re-confirmed all IXSCAN, no COLLSCANs (§13.2.2).
- **Vector latency**: 1k catalog measured (p50 2.16s/p95 5.46s); 10k/50k
  blocked — a 10k `insertMany` hung 20+ minutes with no progress, consistent
  with already-documented Atlas TLS flakiness extending to bulk writes.
- **k6 load tests**: all 4 core paths run live. Headline finding — `/api/books`
  averages 270ms single-request but 2.08s (p95 2.88s) under 20 concurrent
  users, with zero errors; a confirmed Redis cache-hit read took 3.5–4.2s.
  Reads as network latency from this dev machine to the remote Atlas/Redis
  Cloud endpoints, not an application defect (query plans are all sub-10ms
  server-side) — flagged for re-measurement from infra closer to the DB
  before drawing production-capacity conclusions.
- **Lighthouse**: dev-server run (Performance 55) is a known artifact of
  Vite's unbundled dev mode; production-build baseline recorded instead
  (Performance 83, LCP 2.9s) — this is the number to use going forward.

## 2026-08-20 re-verification run (§13.1, Chrome e2e)

The §13.1 experimentation layer was re-tested end-to-end against the running stack
(backend re-booted to reconnect to Atlas after a transient TLS drop; frontend Vite
serving `:5173`):

- **API**: homepage for a cold-start user → `arm` assigned + persisted; a
  non-cold-start hybrid-arm user → `recommendedForYou` (8) with `reasons`
  ("Because you read X" / "Similar to your recent reads" / "Trending in …");
  two fresh users randomized to the **popularity** arm → all recommendation slots
  served "Most popular with all readers" (control works). Arm stayed stable across
  separate logins/sessions (persistence confirmed).
- **AB report endpoint** (`GET /admin/analytics/ab-report`): real events — hybrid
  imp=82 clk=2 conv=1, per-source breakdown correct, z-test computed.
- **Chrome (Playwright/Chromium)**: two new permanent e2e specs added
  (`e2e/phase13-ab.spec.ts`) covering (1) homepage A/B arm + "why" badges +
  `recommendation_view`/`recommendation_click` payloads, and (2) the admin AB panel
  rendering hybrid/popularity rows + z-test verdict + per-source breakdown.
- **Full suites after the changes**: backend Jest 26/26, frontend Vitest 14/14,
  Playwright Chrome e2e **8/8** (6 existing + 2 new); `tsc` + eslint clean on both
  apps.
- `UPDATED_FUTURE.md` §13.1 checkboxes updated to reflect the completed state; only
  the "run over a real usage window" item remains deferred (needs live traffic).

## 2026-08-18 live-verification run (summary)

Everything below was executed against the live Atlas cluster (`test` database, 185 books, 72 users) with both apps running:

- **Bugs found & fixed while verifying**
  - `dataset.ts` used `b.id` on `.lean()` docs → every book collapsed under key `undefined` (`export:dataset` reported "1 books"). Fixed to `_id.toString()`; export now yields 185 books / 72 interactions / 21 users.
  - `Book.ts` lacked `rating`/`reviewsCount`/`createdAt` indexes → homepage COLLSCANs. Indexes added; `bench:query-plans` re-run shows IXSCAN everywhere.
  - **Cover-image data hygiene** — 13 books and 6 category covers referenced removed static paths (`/books/bookN.jpg`, legacy of the pre-2026-08-07 static-cover seed). Repaired all 13 books with real Open Library covers (verified by decoding each image's actual dimensions: 179/179 unique URLs healthy); 3 books without any Open Library record and 6 categories were cleared so the frontend renders its designed gradient placeholder instead of a broken image. Re-verified in a real browser (Playwright/Chromium): homepage 17/17 covers load, book detail 5/5, categories 11/11, zero broken images.
  - Redis homepage cache had no stale entries; category cache refetched clean.
- **Live endpoint smoke**: books / search / categories / plans / homepage (with `arm`+`reasons`) 200; register 201, login 200, me/cart/wishlist ok; analytics track 200; admin login + `ab-report` 200; assistant reaches auth then Gemini free-tier 429 (degrades gracefully).
- **AB report live**: hybrid arm imp=2 clk=1 conv=1, CTR 50%, per-source breakdown correct.
- **Eval live**: `eval:recommendations` over the real snapshot ran all 8 strategies (1 measurable user); `eval:ab` verified against live events.
- **Offline verification**: backend tsc clean, lint 0 errors (5 known warnings), Jest 26/26; frontend lint clean, build clean, Vitest 14/14.