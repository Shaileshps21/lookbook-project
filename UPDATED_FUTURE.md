# 📚 LookBook — System Architecture (Phases 0–12) & Engineering Roadmap (Phase 13)

> Phases 0–12 are **complete** — every item below is built, wired, and verified per
> `CHANGES.md` (65/66 live API smoke checks green, backend Jest 21/21, frontend Vitest
> 14/14, Playwright e2e 6/6, as of the 2026-08-16 verification pass). This document has
> changed role accordingly: **Part A is as-built architecture documentation** (what
> exists, how it's wired, why it's shaped that way) instead of a build plan. **Part B
> (Phase 13)** is the only forward-looking section — the next round of engineering work:
> one in-progress product feature (recommendation experimentation), plus hardening the
> existing system (performance, security, documentation, deployment) rather than adding
> new user-facing surface area. AI is one subsystem among many here (§A.3) — this phase
> treats it that way, not as the centerpiece.

---

## Part A — System Architecture (Phases 0–12, As Built)

### High-Level Architecture

```
┌─────────────────────────┐        HTTPS/JSON, SSE          ┌───────────────────────────┐
│   lookbook-frontend        │ ─────────────────────────────▶ │    lookbook-backend          │
│   React 19 + TS + Vite      │ ◀───────────────────────────── │    Express + TS + Mongoose    │
│   Tailwind, Framer Motion    │      JWT access token in       │    (http://localhost:5000)     │
│   (http://localhost:5173)     │      Authorization header,      └──────────┬────────────────┘
└─────────────────────────┘      refresh token in httpOnly              │
        │            ▲               cookie + CSRF double-submit         │
        │            │                                                     │
        ▼            │                                        ┌────────────┴───────────────────────┐
  Service Worker  Web Speech API                              │                                        │
  (offline shell,   (voice search,                    ┌───────▼───────┐   ┌───────────┐   ┌────────▼────────┐
  push handlers)     client-side)                       │   MongoDB       │   │   Redis      │   │  BullMQ Workers    │
                                                          │   (Atlas)        │   │ (cache +    │   │  (reminders,          │
                                                          │  + Atlas Vector  │   │  BullMQ      │   │   analytics rollup,   │
                                                          │  Search           │   │  broker)     │   │   leaderboard cache)  │
                                                          └────────────────┘   └───────────┘   └──────────────────┘
                                                                   │
                          ┌────────────────────────────────────────┼───────────────────────────────────────┐
                          ▼                    ▼                    ▼                    ▼                    ▼
                    ┌───────────┐      ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌───────────────┐
                    │ Razorpay /  │      │  Cloudinary    │    │ Groq / Gemini  │    │ Open Library   │    │  SMTP (mailer)  │
                    │ Stripe       │      │  (image CDN)   │    │ (LLM, vision,  │    │ (catalog import,│    │  + Web Push       │
                    │ (payments +  │      │                │    │  embeddings,   │    │  ISBN lookup)   │    │  (VAPID)           │
                    │  webhooks)   │      │                │    │  Whisper)       │    │                │    │                    │
                    └───────────┘      └──────────────┘    └──────────────┘    └──────────────┘    └───────────────┘
```

Every external integration is **degrade-gracefully by design**: a missing/invalid
credential (Groq, Cloudinary, Stripe, Shiprocket — see the credential table in §A.13)
disables only that feature's UI affordance rather than breaking the app, because each
was built against a `GET /config`-style capability check or a try/catch fallback, not
an assumed-present key.

---

### A.0 — AI Provider Architecture (Groq/Gemini Split)

**Design decision (documented, not incidental):** the system is built against a
provider-agnostic AI layer, not a hard Groq dependency, because Groq has no embeddings
endpoint (only chat/vision/Whisper) — embeddings were always going to need a second
provider regardless of credential status.

- **As specified:** Groq (`GROQ_API_KEY`, `GROQ_TEXT_MODEL`, `GROQ_VISION_MODEL`) for
  chat/completion, vision extraction, and voice transcription; a separate embeddings
  source for semantic search.
- **As actually running:** the provided Groq key is invalid (see §A.13), so the backend
  runs on **Gemini** (`gemini-2.5-flash` for text/vision, `gemini-embedding-001` for
  embeddings) end-to-end through the same abstraction — every §3 AI feature (chat
  assistant, OCR, duplicate detection, cover-quality check, review sentiment) is
  provider-swappable by env var alone, with no controller-level code path forked on
  provider identity.
- This dual-capability is itself the raw material for Phase 13's §13.9 comparative
  LLM-provider study — the substitution already happened operationally; it just hasn't
  been measured yet.

---

### A.1 — Core Platform Architecture

#### 1.1 Authentication
- **Token model:** short-lived JWT access token (Authorization header, kept in memory
  frontend-side) + long-lived refresh token in an **httpOnly cookie**, rotated on every
  use via an atomic `findOneAndUpdate` (prevents concurrent-request replay of a stolen
  refresh token).
- **CSRF:** double-submit-cookie pattern, scoped to the two endpoints that authenticate
  purely off the refresh cookie (`/auth/refresh`, `/auth/logout`) — cookie path is `/`
  (a real bug was found and fixed here: scoping the cookie to `/api/auth` meant the
  frontend, served from `/`, could never read it back to echo as a header).
- **OAuth:** Google + GitHub, manual authorization-code exchange (no SDK) —
  `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET`. GitHub verified working
  end-to-end; Google is blocked purely on redirect-URI registration in Google Cloud
  Console (§A.13), not a code defect.
- **2FA (TOTP):** opt-in via `otplib`. Login for a 2FA-enabled account returns a
  short-lived `purpose: "2fa-challenge"` JWT (a distinct token type, not reusable as a
  Bearer access token) instead of a session; a second call exchanges challenge + code
  for the real session pair.
- **Email verification gate:** Gmail-only registration (`@gmail.com` enforced at the
  validator, OAuth signups exempt since the provider already vouches for the address);
  `requireVerifiedEmail` middleware blocks `POST /orders/checkout` specifically —
  browsing/cart/wishlist work unverified, real money doesn't move until verified.

#### 1.2 Personalization
- **Signal collection:** every meaningful action logs to `UserActivity`
  (`{ user, book, action, weight, timestamp }`), independent of `Order`/`Wishlist`
  state, giving a time-ordered feed for both the recommendation engine (§A.3.2) and the
  reading dashboard (§1.4).
- **Homepage sections as queries:** Continue Reading, Recommended For You, Because You
  Read X, Popular In Your Genre, Recently Viewed, New Releases, Similar To Wishlist —
  each computed per user and **cached in Redis for 1 hour**.
- **Cache invalidation** (a real bug found and fixed): the 1-hour cache was never
  invalidated on preference change or new activity, so a cold-start snapshot froze
  regardless of later behavior. Fixed by invalidating on `updatePreferences` and inside
  the shared `logActivity` utility — the single choke point every signal already flows
  through.
- **Cold start:** falls back entirely to onboarding preferences + global trending, so
  the homepage is never empty for a new user.

#### 1.3 Roles & Dashboards
- **Role model:** `User.role` (`user | admin`) **plus** an independent `isSeller`
  boolean — a user is a buyer and seller simultaneously, not mutually exclusive roles.
- **Route guarding:** frontend role-aware guards (`/dashboard`, `/seller`, `/admin`)
  matched by backend middleware (`protect`, `sellerOnly`, `adminOnly`) in the same
  pattern.
- **Becoming a seller:** listing-approval flow auto-promotes `isSeller: true` on first
  approved listing — the "apply as seller" and "get a listing approved" paths were
  originally separate concepts and were reconciled into one.

#### 1.4 Reading Dashboard
- Derived primarily from existing `Order` history (books-read count, money saved =
  `buyPrice - rentPrice` summed across rentals, favourite genre/author as a mode over
  the user's orders) rather than a new tracking system.
- **Explicit signal added where the model didn't have one:** a "mark as reading /
  finished" action on active rentals/purchases, logged with a timestamp, backs the
  streak counter and calendar heatmap. Charting reuses Recharts (already a frontend
  dependency).

#### 1.5 Sustainability Dashboard
- Computed from aggregate rental counts (platform-wide and per-user) against documented
  conversion constants (paper saved, trees saved per N books) shown openly on the page.

---

### A.2 — Commerce Architecture

#### 2.1 Payments
- **Dual provider, webhook as source of truth.** Razorpay (raw `fetch`, no SDK) for
  UPI/net-banking/India cards; Stripe (hosted Checkout Session) for international
  cards — provider offered based on `GET /config` capability flags, not hardcoded.
- **Flow:** frontend creates a `PaymentPending` `Order` first (source of truth for what
  was ordered) → backend creates the matching provider order/intent → frontend opens
  the provider widget → **the provider's webhook**, not the frontend's success callback,
  is what flips `Order.paymentStatus` to `Paid` and decrements stock (both
  `RAZORPAY_WEBHOOK_SECRET` and `STRIPE_WEBHOOK_SECRET` signature-verified) — a
  frontend "it worked" message is never trusted alone.
- **UPI-specific:** Razorpay's dedicated QR Codes API isn't provisioned on the current
  test account (confirmed via direct API call, an account-level gate, not a bug); the
  working alternative implemented instead scopes Razorpay's standard checkout widget
  directly to its UPI block (`config.display.blocks.upi`), which already renders a real
  scannable QR — no extra API product required.

#### 2.2 Rentals
- `dueDate` on each rental `OrderItem`; a **BullMQ repeatable job** sweeps for
  upcoming-due rentals and sends reminder emails (idempotent via a `reminderSentAt`
  field so retries/redeploys can't double-send).
- Extend → prorated fee → same payment flow as §2.1 → `dueDate` pushed out on success.
  Late-fee sweep, return flow (stock incremented back on receipt), and a damage/lost
  report → admin review → replacement-fee charge, all implemented.

#### 2.3 Delivery
- `Address` is its own collection (not free text). Shipment tracking is a **manual
  admin editor** (`PATCH /admin/orders/:id/tracking` — carrier, tracking number,
  status, URL, pickup slot) rather than a live courier-aggregator integration, since no
  Shiprocket API key is provisioned (§A.13) — the data model and UI are ready to be
  driven by a real courier webhook later without a schema change.

---

### A.3 — AI Features Architecture (Groq/Gemini-backed)

#### 3.1 AI OCR Book Upload
Cover photo → Cloudinary (storage/CDN) → vision model structured-extraction prompt
(title/author/ISBN/edition/publisher/language/category as JSON) → backend validates
shape → cross-checked against the internal catalog + Open Library for ISBN dedupe → a
second (cheaper) text-model call predicts rental/sell price + demand score → seller
sees a pre-filled, human-confirmed form. Live in `POST /listings/scan` +
`GET /listings/scan-price`.

#### 3.2 AI Search & Recommendation Engine
- **Embedding pipeline:** on `Book` create/update, an embedding is generated from
  title + author + description + tags. Stored via **MongoDB Atlas Vector Search**, with
  an **in-process cosine-similarity fallback** implemented so the feature degrades
  rather than fails if Atlas Vector Search is unavailable.
- **Natural-language search:** query → LLM parses it into structured filters
  (genre/mood/price) as JSON → structured filters run as a normal Mongo query → the
  raw query text is separately embedded and run as a vector similarity search for
  "vibe" matching → both result sets merged and re-ranked.
- **Recommendation:** a per-user taste vector (average of embeddings for
  rented/bought/wishlisted books) recomputed on a schedule, queried via nearest-neighbor
  against the book embedding index.
- This is the system's most research-relevant component — see Phase 13.

#### 3.3 AI Chat Assistant
Floating widget → `POST /assistant/chat/stream` (SSE) with a system prompt carrying the
authenticated user's context (recent orders, active rentals, membership). Read-only
tool-calling (`searchBooks`, `getOrderStatus`, `getActiveRentals`) — the model decides
which tool to call, the backend executes the actual DB read and returns the result for
the model to phrase. **Guardrail:** no state-changing tool is exposed to the assistant
without a confirmation step (consistent with never letting the model act unilaterally).
Streamed token-by-token for a responsive typewriter effect on the frontend.

#### 3.4 AI Book Summary
Computed once per book (creation or backfill batch), stored as `Book.aiSummary`, served
from the DB thereafter rather than regenerated per view — key takeaways, difficulty,
estimated reading time, target audience, topics, labeled as AI-generated alongside the
publisher description.

#### 3.5 AI Review Analysis
Batched per book on a schedule/threshold of new reviews: aggregate sentiment %,
pros/cons bullets, tone — cached on the `Book` document, surfaced above the raw review
list.

#### 3.6 AI Duplicate Listing Detection
Cheap exact/fuzzy ISBN/title/author match first; if a close-but-not-exact match exists,
vision model compares the new cover photo against the candidate's, flags likely
duplicates (`duplicateFlag`, `duplicateCandidate`, `duplicateReason` on `Listing`) for
**admin review**, never auto-merge/auto-reject. Admin UI shows a side-by-side
comparison modal.

#### 3.7 AI Cover Quality Check
Inline check at upload time, before Cloudinary storage — vision model answers
clear/in-focus yes/no with a reason; a "no" rejects at upload with the reason shown to
the seller.

#### 3.8 Voice Search
Client-side: Web Speech API (`en-IN`) captures and transcribes directly in the browser,
feeding the transcript into the existing §3.2 search flow — no backend audio round trip
needed for this path. A backend transcription endpoint
(`POST /assistant/transcribe`, Whisper-backed) also exists for the audio-upload case.

---

### A.4 — Admin Portal Architecture
`/admin`, gated by the `adminOnly` middleware pattern. Dashboard metrics; full book CRUD
+ CSV bulk import (Zod-validated per row, row-level error reporting); Open-Library
search/import panel (dedupe-aware, synthesizes pricing from page count, kicks off
background embedding generation); seller-application approval/rejection (emailed);
sell-listing moderation (duplicate-flag-prioritized); order management (status
overrides, refunds — a real bug fixed here: several order-mutation endpoints returned
unpopulated documents, showing "Unknown ()" for buyer/book, fixed by populating before
every response); damage-report resolution; user suspend/reinstate (blocks login and
active sessions); audit-log viewer; product-analytics funnel panel;
smart-rental-pricing editor.

---

### A.5 — Seller Portal Architecture
`/seller`, gated by `isSeller`. Inventory & listings, per-seller order view (line items
scoped to that seller's books), revenue/commission math (10% flat, documented as
illustrative) with **server-recomputed** payout balances (a client-submitted amount is
never trusted), payout request flow with an admin approval queue, per-listing funnel
(views → wishlists → purchases) reusing the `UserActivity` log.

---

### A.6 — Community Architecture
Follow system (`Follow` collection, counts, feed of followed users' recent reviews).
**Shelves:** the old `user.wishlist` array was generalized into a real `Shelf` model —
migrated with **zero frontend contract changes** (`/api/wishlist` now reads/writes the
default private Shelf under the hood), plus new endpoints for arbitrary named/public
shelves. Public opt-in profiles. Book clubs (`Club` + `Thread`/`Comment`, owner/admin
edit and member-removal, cascade-delete of threads on club deletion). Verified Reader
badge computed at display time (not stored) by checking for a paid
Delivered/Returned order containing that exact book. Reading challenges/badges/
leaderboard — leaderboard is a **scheduled aggregation job**, not a live query, to keep
it cheap; cached via the same BullMQ pattern as analytics.

---

### A.7 — Performance & Infra Architecture
- **Redis caching:** homepage sections, categories, plans — with correct invalidation
  wherever the underlying counts/preferences change.
- **BullMQ job queue** (rental reminders, analytics rollup, leaderboard cache) — a real
  production-grade bug was found and fixed here: all Queues/Workers originally shared
  **one** ioredis connection, but BullMQ Workers issue blocking commands that tie up the
  whole socket, so any transient Redis blip took every queue down at once (`could not
  renew lock`, fatal job loss). Fixed by giving every Queue/Worker its **own**
  connection, raising `lockDuration` for slow jobs, and rate-limiting log noise for
  transient reconnects while still logging real job failures in full.
- **Cloudinary** for upload storage/CDN (multer → Cloudinary → CDN URL) — code-complete
  and tested up to the provider's own credential rejection (§A.13).
- **DB indexing** matched to the query patterns each phase actually introduced
  (`Order.items.book`/`status`, `UserActivity.action+createdAt`, `Listing.status`).
- **Docker + CI/CD:** Dockerfiles (frontend nginx + backend) and a GitHub Actions
  lint/typecheck workflow exist but are **unverified** in this sandbox (no Docker
  daemon, no git remote available) — needs a run on real infra to confirm.
- **Structured logging:** `pino`/`pino-http` — fixed a real gap where errors were only
  logged in dev; production errors previously went entirely unrecorded.
- **Bundle size:** the ISBN barcode scanner (`@zxing/library`, ~412 kB) is
  `React.lazy`-split so it only loads when the scanner modal opens — cut the main JS
  chunk from ~1.03 MB to ~615 kB (gzip 286 → 175 kB).

---

### A.8 — Testing Architecture
- **Backend:** Jest + Supertest + `mongodb-memory-server` (fully isolated in-memory DB
  per run; Redis/BullMQ explicitly disabled in tests after a real bug where the first
  test run connected to the **production** Redis Cloud instance because only
  `MONGO_URI`/`JWT_SECRET` were overridden, not `REDIS_URL` — fixed in
  `globalSetup.ts` plus a `forceExit: true` safety net). 21/21 passing.
- **Frontend:** Vitest + Testing Library, 14/14 passing.
- **E2E:** Playwright (Chrome), 6 specs covering register→browse→cart→checkout,
  reviews, dark mode, the public API docs page, ISBN scanner pre-fill, and an AI-chat
  SSE round trip. 6/6 passing.
- **Live API smoke:** a standalone Node+fetch harness exercising 66 real endpoints
  against the running stack — 65/66 green, the one failure being the admin Open Library
  search returning a clean 503 because the sandbox has no outbound internet (an
  environment limitation, not a defect).

---

### A.9 — Security Architecture
Rate limiting beyond auth (reviews 20/hr, listings 10/hr, checkout 15/10min). CSRF
double-submit cookie on the two cookie-only-authenticated endpoints. 2FA (TOTP,
distinct challenge-token type). Append-only `AuditLog` on every sensitive admin action.
Refresh-token rotation with atomic replay detection (§1.1). Automated DB backups are
delegated to MongoDB Atlas's built-in scheduled snapshots rather than a custom job —
verify it's enabled on your cluster's Backup tab.

---

### A.10 — Notifications Architecture
**Email** (order confirmation, refund, price-drop-on-wishlisted-book, rental-due
reminders, seller approval/rejection) via SMTP, templated in `mailer.ts`. **In-app
notification center**: `Notification` model, bell icon with unread-count badge,
fired from the same events as email. **Web push**: VAPID-keyed subscribe/unsubscribe
(`sw.js` push + notificationclick handlers, `NotificationBell` toggle), landed once the
PWA shell (§A.12) existed to host it.

---

### A.11 — Analytics Architecture
**Self-hosted product analytics** (not an external SaaS): `sendBeacon`-based tracker
with a persisted anonymous session id, `page_view` fired on every route change, backed
by an `Event` collection and `GET /admin/analytics/events` funnel panel
(7/14/30-day selector). **Business analytics**: a daily BullMQ job rolls up revenue,
order count, new/active users, top rented/sold books, and genre popularity into one
`AnalyticsSnapshot` document per day (first run backfills history in one pass rather
than waiting a day per data point). External SaaS (PostHog/GA4/Mixpanel) intentionally
not integrated — the self-hosted tracker covers the funnel until a real account exists.

---

### A.12 — PWA & Phase 12 Status
**Shipped:** PWA basics (`manifest.webmanifest`, a hand-written `sw.js` that caches the
app shell for offline launch but **deliberately never caches `/api/*`**), dark mode
(`ThemeContext`, defaults to `prefers-color-scheme`, persisted), the public API docs
page (`/developers`), smart/dynamic rental pricing (rule-based, admin-bounded, batch
"run pricing" job), barcode/ISBN scanner. **Deliberately not started** (per the
roadmap's own "revisit based on demand" guidance, not an oversight): React Native app,
i18n/multi-currency, book exchange/donation, library-management mode, university/
enterprise plans, coupons/support tickets/reports.

---

### A.13 — Known Environment/Credential Gaps (Not Code Defects)

| Item | Status | Action needed |
|---|---|---|
| Groq API key | Invalid — Gemini substituted throughout | Regenerate at console.groq.com, *or* keep the Gemini path and treat the substitution as §13.9's comparison subject |
| Cloudinary credentials | `Invalid cloud_name` | Regenerate at the Cloudinary dashboard — blocks seller listing-photo upload |
| Google OAuth redirect URI | Not registered | Add `http://localhost:5000/api/auth/google/callback` in Google Cloud Console |
| Razorpay QR Codes API | Not provisioned on the test account | Standard checkout's UPI-scoped view already covers this; only matters for a *standalone* QR product |
| MongoDB Atlas connectivity | Intermittent multi-minute outages observed during dev | Check cluster health/network-access history if recurring |
| Shiprocket / courier API | No key provisioned | Tracking data model + manual admin editor are ready to be driven by a real webhook once a key exists |
| Sentry / APM | No DSN configured | Structured `pino` logging is in place as the interim substitute |
| PostHog/GA4/Mixpanel | No account | Self-hosted `Event` tracker (§A.11) covers the funnel meanwhile |

---

## Part B — Phase 13: Experimentation & Platform Hardening

With Phases 0–12 feature-complete, this phase does two kinds of work: finishing the one
piece of new infrastructure already underway (§13.1, in progress), and making the
existing system measurably solid rather than just "working" — performance, security,
documentation, and deployment (§13.2–13.5). Nothing here is research for its own sake;
each item is the kind of hardening any production web platform needs before/around a
real launch.

### 13.1 Recommendation Experimentation Infrastructure — *in progress*

The recommendation engine (§A.3.2) already produces results; this adds the
**feature-flagging + measurement layer** around it so future changes to it can be
compared safely instead of shipped on faith — general product infrastructure, not
specific to AI.

- [x] Explored backend: recommendation/search engine, homepage personalization,
  embeddings, `UserActivity`/`Event` models, existing scripts.
- [x] Explored frontend: homepage sections, recommendation display, `BookCard`,
  personalization UI.
- [x] **Backend core — complete (verified live 2026-08-20):**
  - `User.recommendationArm` — a persistent per-user arm assignment (e.g.
    `"hybrid"` vs `"popularity"`), set once and reused, so a given user has a
    consistent experience across sessions instead of being re-randomized on every
    request. **No schema default** — assigned lazily & atomically on first
    homepage fetch (`homepageController.ts:ensureArm`); verified persistent
    across requests and separate logins.
  - `GEMINI_TEXT_MODEL` env var — the model identifier is now configurable rather
    than hardcoded, so the underlying model can be swapped without a redeploy
    (`config/env.ts`, `utils/ai.ts`).
  - Homepage A/B arms — the personalization pipeline (§A.1.2) branches on
    `recommendationArm`, serving either the full hybrid pipeline or a
    popularity-only baseline from the same endpoint. Both arms verified live
    (`arm: "hybrid"` and `arm: "popularity"` observed; control arm serves
    "Most popular with all readers").
  - Explainability reasons — each recommended book carries a short "why" tag
    (matched genre / similar to book X / trending in your category / behavioral
    signal), computed at recommendation time by reusing signals §A.3.2 already
    produces — this is a small UI trust feature, not a new subsystem.
  - Analytics events — click/wishlist/conversion events are tagged with the
    serving arm, so outcomes can be attributed back to which pipeline produced the
    recommendation (`recommendation_view` / `recommendation_click` + conversion
    events; verified firing with `{arm, section, reason, bookId(s)}`).
  - AB report endpoint — an admin-facing aggregation of click-through/conversion
    rate per arm, reusing the existing admin-analytics pattern (§A.11)
    (`GET /admin/analytics/ab-report`, two-proportion z-test; verified against
    live events).
- [x] **Remaining:**
  - Admin UI panel to view the AB report — **done**: `ProductAnalyticsPanel`
    renders the arm table + z-test verdict + per-source conversion breakdown
    (§13.8); verified rendering in Chrome.
  - Decide whether arm assignment needs any frontend awareness at all — likely
    not, since the split is served transparently from the backend. **Decision
    recorded** in `docs/thesis/design-decisions.md`: transparent serving; the
    frontend only tags events, never branches behavior.
  - Let it run over a real usage window before drawing any conclusion from the
    numbers; a few days of traffic is not enough to trust a click-through
    difference. *(Deferred — needs live traffic; nothing in-repo blocks it.)*

> **Verification (2026-08-20):** the whole §13.1 surface was re-tested in Chrome
> (Playwright/Chromium) against the running stack — homepage A/B arms with "why"
> badges, `recommendation_view`/`recommendation_click` payloads, and the admin
> AB-report panel. Two dedicated e2e specs were added (`e2e/phase13-ab.spec.ts`);
> full suite now 8/8 passing. Backend Jest 26/26, frontend Vitest 14/14, lint &
> `tsc` clean on both apps.

### 13.2 Performance & Load Testing — *run live 2026-08-27*

> **Status:** all 4 items below have been run against the live stack (not just
> built). Full results: `lookbook-backend/docs/thesis/performance-load-testing.md`.
> Headline: query plans are clean (all IXSCAN); k6 load tests surfaced a real
> concurrency gap (`/api/books` 270ms solo → 2.08s avg at 20 concurrent users,
> even a Redis cache-hit read took 3.5–4.2s) that reads as network latency
> from this dev machine to the remote Atlas/Redis Cloud endpoints rather than
> an app-code defect — worth re-measuring from infra nearer the database
> before drawing capacity conclusions. Vector-latency 10k/50k tiers remain
> blocked by the same Atlas write flakiness tracked in §13.6. Lighthouse
> baseline recorded from a production build (Performance 83, LCP 2.9s), not
> the misleading dev-server run (Performance 55).

1. **Load test the core read/write paths** (book search, checkout, AI search, chat
   assistant) with k6 or Locust — report p50/p95/p99 latency and max sustained
   requests/sec at increasing concurrency, on both a cold cache and warm Redis cache
   (§A.7), to quantify the caching layer's actual impact rather than asserting it
   qualitatively.
2. **Query plan analysis** — run `.explain("executionStats")` on the top 5 heaviest
   MongoDB queries (search/filter/sort, homepage sections, admin analytics
   aggregations), confirm the indexes from §A.7 are actually used, and fix/document
   any collection scans found.
3. **Vector search latency** — benchmark the embedding similarity search (Atlas
   Vector Search or the in-process cosine-similarity fallback, §A.3.2) as catalog
   size grows synthetically (seed 1k / 10k / 50k books) — this is the piece most
   likely to hit a scalability limit worth planning around.
4. **Bundle/asset audit** — extend the lazy-loading win already made on the ISBN
   scanner (§A.7) to any other heavy, rarely-used chunk; re-run a Lighthouse pass on
   the main flows (home, search, checkout) and record the scores as a baseline.

### 13.3 Security Review

1. **OWASP Top 10 pass** against the actual app — injection (Mongoose/Zod, document
   how), broken auth (refresh-token rotation, §A.1.1), sensitive data exposure
   (audit what each API response actually returns vs. what's stored), CSRF (§A.9),
   rate limiting (§A.9) — a short "risk → existing mitigation → residual risk" table
   per item.
2. **Dependency audit** — `npm audit` on both frontend and backend; fix what's
   fixable, document anything left open and why (date it — dependencies drift).
3. **Secrets hygiene** — confirm nothing in §A.13's credential list is committed
   anywhere in the repo history, and that `.env.example` never has a real value.

### 13.4 Architecture Documentation & Design-Decision Log — *re-verified 2026-08-27*

> **Status:** all 4 docs exist and were checked against the actual code, not
> assumed current. Full results: `lookbook-backend/docs/phase-13-status.md`
> (2026-08-27 section). Real drift found and fixed in 3 of 4: the ER diagram
> was missing 2 real collections (`Plan`, `Shelf`) and had 3 entities that
> don't correspond to any actual collection; the architecture doc had a
> wrong React version and described a caching mechanism that doesn't exist
> in the code; the checkout sequence diagram showed a synchronous flow when
> the real code splits order creation from payment confirmation across a
> client-verify path and an idempotent webhook handler — rewritten to match,
> now covering the webhook confirmation this section originally asked for.
> The design-decision log and the other two sequence diagrams held up
> unchanged.

1. **Formalize the diagrams** — turn the ASCII diagram at the top of this document
   into a proper component/deployment diagram, add a full ER diagram of the MongoDB
   schema, and sequence diagrams for the 2–3 most complex flows (checkout + webhook
   confirmation, §A.2.1; the hybrid search/recommendation flow, §A.3.2). This is
   what makes the system fast to onboard a new contributor onto, not just fast to
   demo.
2. **Design-decision log** — for each major architectural choice already made in
   Part A, write 3–5 sentences on the alternatives considered and why this one was
   picked. Worth capturing explicitly:
   - Groq vs. Gemini for the AI layer (§A.0) — and the fact the system is built
     provider-agnostic in the first place, which is *why* the Groq outage never
     took the AI features down.
   - MongoDB Atlas Vector Search vs. a standalone vector DB.
   - JWT + refresh rotation vs. server sessions.
   - Dual payment provider (Razorpay + Stripe) vs. a single provider.
   - Self-hosted event tracking vs. an external analytics SaaS.
3. This log is cheap to write (it's documenting decisions already made) and is the
   single highest-leverage item in this phase for anyone else reading the codebase
   later — including future-you.

### 13.5 Deployment & Reproducibility — *re-verified 2026-08-27 (item 1 still needs real infra)*

> **Status:** items 2–3 (setup-from-scratch doc, seed versioning) confirmed
> accurate against source and re-run live. Item 1 (Docker + CI on real
> infra) still can't run here — no Docker daemon, no git remote, unchanged
> from 2026-08-18, and the user plans to deploy separately. Substitute done
> instead: both Dockerfiles/`.dockerignore` reviewed line-by-line (no
> secrets-leak risk, paths correct), and every CI workflow step
> (lint/typecheck/test) run locally exactly as written for both apps — all
> pass, confirming the workflow itself is correct and would go green if
> triggered. Full detail: `lookbook-backend/docs/phase-13-status.md`
> (2026-08-27 section).

1. **Actually verify Docker + CI** — the Dockerfiles and GitHub Actions workflow
   (§A.7) exist but were never run in this environment (no Docker daemon, no git
   remote available here). Run `docker compose up --build` end-to-end on real infra
   and confirm the CI workflow passes on a real push.
2. **Setup-from-scratch doc** — a single script or documented sequence that takes a
   clean machine to a fully running stack (env vars, seed data, migrations if any),
   so the project can be handed off or redeployed without tribal knowledge.
3. **Seed data versioning** — the `npm run seed` / Open Library import scripts
   already produce a working demo dataset; snapshot one known-good version of it
   (JSON/CSV export) so a specific state can be restored on demand, not just
   "whatever seeding produces today."

### 13.6 Resolve Environment/Credential Gaps

Work through §A.13's table opportunistically — none of it blocks §13.1–13.5, but
resolving Cloudinary and Groq specifically would remove the two credential-driven
gaps most likely to surprise a reviewer trying the app fresh.

---

## Suggested Order for Phase 13

1. **§13.1 first** — it's already underway; finish the backend core items, ship the
   admin AB-report panel, then let it run before drawing conclusions from it.
2. **§13.4 in parallel** — the design-decision log and diagrams can be written from
   Part A directly, any time, with no dependency on anything else in this phase.
3. **§13.2 and §13.3** — performance and security passes, once there's a stable
   build to test against (they don't depend on §13.1 finishing).
4. **§13.5** — deployment verification, whenever real infra (a machine with Docker,
   a git remote) is available; not blocked by anything else here.
5. **§13.6** — credential gaps, as they become available; not urgent, but resolve
   before treating the system as "done."

---

## Env Variables Reference (for quick cross-check)

```
JWT_SECRET, JWT_REFRESH_SECRET
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET
CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET   # currently invalid — see §A.13
GROQ_API_KEY, GROQ_TEXT_MODEL, GROQ_VISION_MODEL                  # currently invalid — see §A.13
GEMINI_API_KEY, GEMINI_TEXT_MODEL, GEMINI_EMBEDDING_MODEL          # in active use as the Groq fallback; GEMINI_TEXT_MODEL now configurable per §13.1
REDIS_URL
MONGO_URI
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
SESSION_SECRET
FRONTEND_URL, BACKEND_URL
VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY                                # web push, §A.10
```

<!-- ----------------------------------------- -->
<!-- # 📚 LookBook v2.0 — Future Roadmap & Implementation Flow

> **Vision:** Build LookBook into a modern, AI-powered book rental, selling,
> and reading platform — combining the best of Amazon, Goodreads, Spotify,
> Netflix, and Kindle into one ecosystem.

This document describes **flow only** — the sequence of steps, services, and
decisions for each feature. No code. Each section notes exactly which `.env`
variable(s) it relies on.

---

## 0. AI Provider Decision: Groq instead of OpenAI

Before the phases, one architectural decision that affects several phases below.

**What Groq is:** an inference provider running open-weight models (Llama,
Whisper, etc.) on custom LPU hardware — extremely fast time-to-first-token
and tokens/sec, at a fraction of typical latency. It's a drop-in-shaped
replacement for a chat-completions API.

**What Groq is *not*:** an embeddings provider. There's no
`text-embedding-*` endpoint on Groq. This matters because "AI Recommendation
Engine," "AI Search," and "Similar Books" all lean on semantic similarity,
which needs vector embeddings, not just a chat model.

**Resulting split:**

| Task type                                             | Provider                                  |
|--------------------------------------------------------|----------------------------------------------|
| Chat/completion, summarization, extraction, classification, natural-language query parsing | **Groq** (a fast Llama text model for text tasks; a Llama vision-capable model for image tasks) |
| Voice transcription (voice search)                     | **Groq** (Whisper-large-v3 is hosted on Groq) |
| Embeddings for semantic search / recommendations        | A separate embeddings source — MongoDB Atlas Vector Search's built-in embedding pipeline (simplest, stays inside the DB you already use), or a dedicated embeddings API if you move to a standalone vector DB later |
| Image storage/transform (book covers, OCR source images)| Cloudinary |

**Env vars to add/rename:**
- `GROQ_API_KEY` (replaces `OPENAI_API_KEY`)
- `GROQ_TEXT_MODEL` (pin the exact model string once checked against Groq's
  current model list — they update/retire models periodically)
- `GROQ_VISION_MODEL` (a vision-capable model, for OCR + cover quality checks)
- `EMBEDDING_PROVIDER` + matching API key (only needed once semantic
  search/recommendations are built — can be deferred)

Every AI section below is written against this split.

---

## 1. Core Product Principles

Every feature should be checked against:

- Modern, premium UI
- AI-first where it adds real value (not AI for its own sake)
- Fast & responsive
- Mobile-friendly
- Community-driven
- Personalized per user
- Easy selling experience
- Secure payments
- Production-ready architecture
- Scalable, microservice-friendly design

---

## ✅ Phase 0 — Current Status (Done)

- React + TypeScript frontend, Tailwind CSS
- Responsive landing page, hero, trending books, popular categories
- Book details page with reviews and similar books
- Wishlist & cart UI, checkout flow
- Membership plans UI
- Express + MongoDB backend: auth (JWT), books, categories, plans, reviews, cart, wishlist, orders, sell listings

---

## 🚀 Phase 1 — Production-Ready Core (Auth, Dashboards, Personalization)

### 1.1 Authentication Upgrade — Flow

1. **Access + refresh token pair.** On login, issue a short-lived access
   token (e.g. 15 min) and a long-lived refresh token (e.g. 30 days), stored
   as an httpOnly cookie. Access token lives in memory on the frontend, not
   localStorage, to reduce XSS exposure.
2. **Silent refresh.** When an API call returns 401, the frontend calls a
   `/auth/refresh` endpoint using the refresh cookie, gets a new access
   token, and retries the original request once. If refresh also fails,
   force logout.
3. **Refresh token rotation + revocation list.** Each time a refresh token is
   used, issue a new one and invalidate the old (store a hash + `revoked`
   flag in a `RefreshToken` collection, using `JWT_REFRESH_SECRET`). Protects
   against token replay.
4. **Google OAuth flow.**
   - Frontend: "Continue with Google" button redirects to a backend OAuth
     start route.
   - Backend redirects to Google's consent screen using
     `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`.
   - Google redirects back with an auth code → backend exchanges it for a
     profile (email, name, avatar) → find-or-create the `User` → issue your
     own JWT pair → redirect to frontend with the session established.
5. **GitHub OAuth** — identical flow, swap provider using
   `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`.
6. **Forgot/reset password.**
   - User submits email → backend generates a one-time reset token (short
     expiry, stored hashed) → emails a reset link via SMTP
     (`SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`).
   - User opens link → submits new password → backend validates token →
     updates password → invalidates the token and all existing refresh
     tokens (forces re-login everywhere, a security best practice).
7. **Email verification.** On register, send a verification link the same
   way; gate certain actions (selling books, checkout) behind
   `emailVerified: true` if desired.
8. **"Remember me" + session management screen.** List active
   sessions/devices (derived from issued refresh tokens) with a "log out of
   this device" action per entry.

### 1.2 Personalized Homepage — Flow

1. **Onboarding step** right after signup: user picks favourite genres,
   favourite authors (autocomplete against existing `Book.author` values),
   a reading goal (books/month), and preferred language. Store on the
   `User` document as a `preferences` sub-object.
2. **Signal collection.** Every meaningful action (view, wishlist, rent, buy,
   review) gets logged to a lightweight `UserActivity` collection —
   `{ user, book, action, weight, timestamp }` — rather than only relying on
   Order/Wishlist state, so you have a time-ordered signal feed.
3. **Homepage sections become queries, not one static list:**
   - *Continue Reading* — active rentals not yet marked returned.
   - *Recommended For You* — nearest-neighbor lookup in vector space (see
     §3.2) seeded by the user's own activity embeddings.
   - *Because You Read X* — pick the user's highest-weighted recent book,
     query its nearest neighbors.
   - *Popular In Your Favourite Genre* — existing "trending" query filtered
     to `preferences.genres`.
   - *Recently Viewed* — last N `UserActivity` entries of type `view`.
   - *New Releases* — existing sort by `createdAt`/`published`.
   - *Similar To Wishlist* — nearest neighbors of the user's wishlisted
     books, excluding books already owned/wishlisted.
4. **Caching.** Precompute each section per user on a schedule (e.g. every
   few hours) into Redis (`REDIS_URL`) rather than computing on every page
   load; homepage reads from cache, falls back to a live query on a miss.
5. **Cold start (new user, no activity yet):** fall back entirely to
   onboarding preferences + global trending, so the homepage is never empty.

### 1.3 Separate Dashboards — Flow

1. **Role model expansion.** Extend `User.role` from `user | admin` to
   `user | admin` **plus** a separate `isSeller` boolean (a user can be a
   seller *and* a regular buyer at the same time, rather than mutually
   exclusive roles).
2. **Route-level guarding.** Frontend: role-aware route guards — `/dashboard`
   (any logged-in user), `/seller` (requires `isSeller`), `/admin` (requires
   `role: admin`). Backend: matching middleware in the same pattern as the
   existing `protect`/`adminOnly` — add a `sellerOnly` middleware alongside them.
3. **Becoming a seller.** A lightweight application flow: user requests
   seller status → admin approves (see Seller Approvals in Phase 4) →
   `isSeller: true` set → seller dashboard unlocks.
4. **User Dashboard** aggregates: profile, wishlist, orders, rentals,
   membership status, reading statistics (Phase 1.4), notifications.
5. **Seller Dashboard** aggregates: their listings (all statuses), inventory
   levels, order line-items belonging to their books, computed revenue,
   payout status, and simple analytics (views → wishlists → sales funnel per
   listing).
6. **Admin Dashboard** — see Phase 4 in full.

### 1.4 Reading Dashboard — Flow

1. Derive stats from existing `Order`/rental history rather than a new
   tracking system initially: books-read count (orders marked
   returned/delivered), money saved (sum of `buyPrice - rentPrice` across
   rentals), favourite genres/authors (mode of `Book.category`/`author`
   across the user's orders).
2. **Reading streak & calendar** need an explicit signal the current model
   doesn't have — add a lightweight "mark as reading" / "mark as finished"
   action on active rentals/purchases, logged with a timestamp, to build a
   calendar heatmap and streak counter.
3. Render as a dedicated dashboard page reusing the same charting library
   already available on the frontend (Recharts).

### 1.5 Sustainability Dashboard — Flow

1. Define simple, defensible conversion constants (e.g. "1 rented book ≈
   X grams of paper saved vs. buying new," "N books reused ≈ 1 tree saved
   per Y books") — document the assumption openly on the page itself for
   credibility.
2. Compute from aggregate rental counts (platform-wide and per-user) and
   display both personal impact and community impact (a running platform
   total), which also doubles as social proof on the marketing side.

---

## 💳 Phase 2 — Commerce

### 2.1 Payments — Flow

1. **Provider selection at checkout** — Razorpay for UPI/net-banking/India
   cards, Stripe for international cards, selected either automatically by
   user locale or explicitly by the user.
2. **Order creation flow:**
   - Frontend calls the existing `/orders/checkout` to create a
     `PaymentPending`-status `Order` in your DB first (source of truth for
     what was ordered).
   - Backend then creates a matching payment-provider order/intent
     (Razorpay Order / Stripe PaymentIntent) using `RAZORPAY_KEY_ID` +
     `RAZORPAY_KEY_SECRET` or `STRIPE_SECRET_KEY`, and returns the
     client-side payment handle to the frontend.
   - Frontend opens the provider's checkout widget with that handle.
3. **Webhook confirmation (source of truth for "did it actually get paid"):**
   - Razorpay/Stripe calls your `/webhooks/razorpay` or `/webhooks/stripe`
     endpoint on payment success/failure, signed with a webhook secret
     (`RAZORPAY_WEBHOOK_SECRET` / `STRIPE_WEBHOOK_SECRET`).
   - Backend verifies the signature, then updates `Order.paymentStatus` to
     `Paid`/`Failed` and only *then* decrements stock / clears the cart —
     never trust a frontend "payment succeeded" callback alone, since that
     can be spoofed or interrupted mid-flow.
4. **Refunds & cancellations** — an admin/user-triggered action that calls
   the provider's refund API, then updates `Order.status` to `Refunded` /
   `Cancelled`, with a grace-period rule enforced before allowing
   self-service cancellation.

### 2.2 Rentals — Flow

1. Add `dueDate` to each rental `OrderItem` at checkout time
   (`checkout date + plan-defined rental period`).
2. **Reminder job** (scheduled, e.g. a daily cron-style or BullMQ repeatable
   job): sweep for rentals due in N days → send an email reminder.
3. **Extend flow:** user requests an extension on an active rental → backend
   computes a prorated fee → routes through the same payment flow as §2.1 →
   on success, pushes out `dueDate`.
4. **Late fee flow:** daily sweep marks overdue rentals, computes an
   accruing late fee, surfaces it in the user's dashboard, and blocks new
   rentals until settled.
5. **Return flow:** user requests return → pickup scheduling (§2.3) →
   once received, admin/seller marks the item `Returned` → stock incremented
   back → any deposit/late fee settled.
6. **Damage/lost workflow:** a report form on the rental → admin review →
   charge a pre-agreed replacement fee via the same payment flow.

### 2.3 Delivery — Flow

1. `Address` becomes its own collection (`{ user, label, line1, line2, city,
   state, pincode, isDefault }`) instead of a free-text field; checkout
   picks one or adds a new one inline.
2. **Shipment tracking:** on order confirmation, call a courier aggregator
   API (e.g. Shiprocket) to generate a shipment + tracking ID, store it on
   the `Order`, and expose a tracking widget on the order detail page
   (poll the courier API or receive their webhook for status updates).
3. **Pickup scheduling** (for sell listings and returns): a simple
   date/time-slot picker calling the courier aggregator's pickup-scheduling
   endpoint, confirmation stored on the `Listing`/`Order`.

---

## 🤖 Phase 3 — AI Features (Groq-centric)

### 3.1 AI OCR Book Upload — Flow

1. Seller uploads one photo of the book (cover + spine ideally) → the image
   goes to Cloudinary first (`CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/
   `CLOUDINARY_API_SECRET`) for storage/optimization, returning a public URL.
2. That URL is sent to **Groq's vision model** (`GROQ_VISION_MODEL`) with a
   structured-extraction prompt asking for title, author, ISBN, edition,
   publisher, language, and category as strict JSON.
3. Backend validates the JSON shape (reject/retry once if malformed), then
   **cross-checks the extracted ISBN** against your own `Book` collection
   and optionally a public books API (Open Library / Google Books) to
   fill in any fields the vision model missed or got wrong.
4. A second Groq **text** call (`GROQ_TEXT_MODEL` — cheaper/faster than
   vision) takes the confirmed metadata + condition description and
   predicts a suggested rental price, sell price, and a rough "demand
   score," using few-shot examples from your actual historical
   listing/sales data as context.
5. Seller sees a **pre-filled form** with everything above, edits anything
   wrong, and confirms — the AI never auto-publishes without human
   confirmation.

### 3.2 AI Search & Recommendation Engine — Flow

1. **Embedding pipeline (not Groq — see §0):** whenever a `Book` is
   created/updated, generate an embedding from its title + author +
   description + tags, store it either in MongoDB Atlas Vector Search
   (simplest — stays in the same DB) or a dedicated vector store.
2. **Natural-language search flow:**
   - User types "horror books with a happy ending under ₹500."
   - The query goes to **Groq** first as a *query parser*: extract
     structured filters (genre: horror, mood: happy-ending, price max: 500)
     as JSON.
   - Structured filters run against your normal MongoDB query (fast, exact).
   - Separately, the raw query text is embedded and run as a vector
     similarity search for "vibe" matching (e.g. "happy ending" isn't a
     field, but is semantically close to certain book descriptions).
   - Merge and re-rank both result sets before returning.
3. **Recommendation engine flow:** build a per-user "taste vector" — either
   the average of embeddings for books they've rented/bought/wishlisted, or
   a lightweight collaborative-filtering job — then run a nearest-neighbor
   search against the book embedding index. Recompute the taste vector on a
   schedule (e.g. nightly), not on every request.
4. Everything in this section that involves *generating natural language* or
   *parsing user intent* uses Groq; everything involving *"what's
   semantically similar to what"* uses the embedding/vector layer.

### 3.3 AI Chat Assistant — Flow

1. A chat widget calling a backend `/assistant/chat` endpoint, which forwards
   to **Groq** (`GROQ_TEXT_MODEL`) with a system prompt describing
   LookBook's tools and the current authenticated user's context (their
   recent orders, active rentals, membership plan).
2. **Tool/function calling:** Groq's chat models support tool calling —
   define backend tools like `getOrderStatus`, `getRentalDueDate`,
   `renewRental`, `searchBooks`, `getSimilarBooks`. The model decides when to
   call one; your backend executes the actual DB action and returns the
   result to the model to phrase a natural-language reply.
3. **Guardrails:** any tool that changes state (renew rental, cancel order)
   should require an explicit confirmation step from the user in the chat
   UI before executing, not just the model's say-so.
4. Stream the response token-by-token to the frontend for a responsive feel
   (Groq's fast inference makes this especially snappy).

### 3.4 AI Book Summary — Flow

1. Triggered once per book (on creation, or backfilled in a batch job) —
   send the publisher description to Groq, ask for: key takeaways,
   difficulty level, estimated reading time, target audience, and topics
   covered, all as structured JSON.
2. Store the result on the `Book` document itself (an `aiSummary`
   sub-object) so it's computed once and served from the DB thereafter, not
   regenerated on every page view.
3. Display alongside the original publisher description, clearly labeled as
   AI-generated.

### 3.5 AI Review Analysis — Flow

1. Scheduled job (or triggered every N new reviews on a book): batch all of
   a book's review text to Groq, ask for aggregate sentiment percentage,
   common pros/cons (as short bullet phrases), and a difficulty/emotional-tone
   read.
2. Cache the result on the `Book` document (recompute periodically, not per
   request) and surface it above the raw review list as a summary card.

### 3.6 AI Duplicate Detection — Flow

1. On new sell-listing submission, compare the submitted ISBN/title/author
   against existing catalog entries first (exact/fuzzy string match — cheap,
   no AI needed).
2. If no exact match but a close one exists, send both the new listing's
   cover image and the candidate match's cover to **Groq's vision model**,
   ask it to judge "same book/edition, yes or no," and flag likely
   duplicates for admin review rather than auto-merging or auto-rejecting.

### 3.7 AI Cover Quality Check — Flow

1. On image upload (before or alongside Cloudinary storage), send the image
   to Groq's vision model with a simple prompt: "Is this a clear, in-focus
   photo of a book cover? Answer yes/no with a reason."
2. If "no," reject at upload time with the model's stated reason shown to
   the seller, prompting a re-upload, rather than silently accepting a bad
   photo that hurts conversion later.

### 3.8 Voice Search — Flow

1. Frontend records a short audio clip on the search bar's mic button.
2. Audio uploads to the backend → backend calls **Groq's Whisper-large-v3**
   endpoint for transcription.
3. Transcribed text is fed into the same natural-language search flow as
   §3.2 — voice search is really just an audio-to-text front door onto
   existing AI search.

---

## 🛠️ Phase 4 — Admin Portal

1. Separate route namespace (`/admin` in the frontend, already
   role-gated by the existing `adminOnly` backend middleware pattern).
2. **Dashboard home:** headline metrics (revenue, active users, pending
   approvals) pulled from the analytics layer in Phase 11.
3. **Books:** full CRUD UI over the existing admin book endpoints, plus bulk
   CSV import (parse CSV → validate each row against the same Zod schema
   the single-create endpoint uses → batch insert, report row-level
   errors).
4. **Seller approvals:** a queue of pending seller applications → approve
   sets `isSeller: true`, reject with a reason emailed to the applicant.
5. **Sell listings moderation:** approve/reject queue (endpoint already
   exists) — surfaced with the AI duplicate-detection flags from §3.6 as a
   priority signal.
6. **Orders:** searchable/filterable table, manual status overrides (mark
   shipped/delivered/returned), refund trigger.
7. **Users:** search, view activity, suspend/reinstate.
8. **Coupons, support tickets, reports** — standard CRUD admin screens once
   those underlying features exist (Phases 2 and 10).

---

## 📦 Phase 5 — Seller Portal

1. `/seller` route namespace, gated by `isSeller`.
2. **Inventory & listings:** seller's own books, edit/delist actions,
   stock-level editing.
3. **Orders:** line items belonging to this seller's books only (a query
   filter on `Order.items.book.sellerId` — requires adding a `sellerId` to
   `Book` once multi-seller inventory exists, vs. today's single-catalog
   model).
4. **Revenue & payouts:** running total of sales minus platform commission,
   a payout request flow, and a payout history table (ties into the payment
   provider's payout/transfer APIs, e.g. Razorpay Route or Stripe Connect —
   this is the point where you'd adopt one of those marketplace-payment
   products rather than plain checkout APIs).
5. **Performance:** simple funnel per listing — views → wishlist adds →
   purchases — reusing the `UserActivity` log from §1.2.

---

## 🌍 Phase 6 — Community

1. **Follow system:** a `Follow` collection (`follower`, `following`);
   profile pages show follower/following counts and a feed option showing
   followed users' recent public reviews/activity.
2. **Reading lists / shelves:** generalize the existing single Wishlist into
   a `Shelf` model (`{ user, name, visibility, books[] }`) — Wishlist becomes
   just the default private shelf.
3. **Public profiles:** an opt-in public view of a user's shelves and
   reviews.
4. **Book clubs & discussion threads:** a `Club` (members, a linked book or
   reading schedule) and a `Thread`/`Comment` model scoped to a club or a
   book page.
5. **Verified Reader badge on reviews:** only show it when the reviewing
   user has a `Delivered`/`Returned` order for that exact book — a simple
   join check at review-display time.
6. **Reading challenges, badges, leaderboard:** define challenge criteria
   (e.g. "12 books in 2026"), track progress via the reading-dashboard
   activity log from §1.4, award badges as documents on the user, and
   compute a leaderboard as a scheduled aggregation job (not a live query)
   to keep it cheap.

---

## ⚡ Phase 7 — Performance & Infra

1. **Redis** (`REDIS_URL`) — introduce for two purposes: (a) caching hot
   read endpoints (books list, categories, plans, homepage sections),
   (b) as the backing store for a job queue (BullMQ) handling reminder
   emails, AI batch jobs, and leaderboard recomputation.
2. **Cloudinary** — all user-uploaded imagery (book covers, listing photos)
   routes through it for automatic optimization, responsive delivery, and
   CDN caching, rather than storing raw files yourself.
3. **Lazy loading & pagination/infinite scroll** — apply to book grids,
   review lists, and order history as data volume grows.
4. **Database indexing** — revisit indexes once real query patterns are
   known from production logs, not just the ones anticipated up front.
5. **Docker + CI/CD** — containerize both apps, add a GitHub Actions
   pipeline running lint/typecheck/tests on every PR, and a deploy step
   gated on that pipeline passing.
6. **Monitoring & logging** — structured logs (not just `console.log`) plus
   an APM/error tracker (e.g. Sentry) wired into both frontend and backend.

---

## 🧪 Phase 8 — Testing

1. **Frontend unit tests** (Vitest + React Testing Library) — hooks,
   contexts, and utility functions first, since they're pure logic and
   highest ROI.
2. **Backend unit + integration tests** (Jest + Supertest, with
   `mongodb-memory-server` for a disposable in-memory DB) — controllers and
   validators, then full request/response cycles per route.
3. **End-to-end tests** (Playwright) — the critical paths: register → browse
   → cart → checkout, and submit a review; expand to seller/admin flows once
   those exist.
4. **CI gate** — all of the above plus lint/typecheck run on every pull
   request before merge.

---

## 🔒 Phase 9 — Security

1. Refresh-token rotation (§1.1) is the biggest single upgrade here.
2. **Rate limiting** beyond auth — extend to review submission, listing
   submission, and checkout to blunt spam/abuse.
3. **CSRF protection** — needed once you rely on cookies for auth (the
   refresh-token cookie); use a double-submit-cookie or synchronizer-token
   pattern on state-changing requests.
4. **2FA (TOTP)** — optional, opt-in per account; store a secret, verify a
   6-digit code at login when enabled.
5. **Audit logs** — record admin actions (who approved which seller, who
   refunded which order) in an append-only collection.
6. **Automated DB backups** — scheduled snapshots (Atlas has this built-in;
   self-hosted needs a cron + `mongodump`) with a periodically *tested*
   restore, not just backups that are never verified.

---

## 🔔 Phase 10 — Notifications

1. **Email** (via `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`): order
   confirmation, rental due reminders, refund updates, seller
   approval/rejection, price-drop alerts on wishlisted books — each as a
   templated transactional email triggered by the relevant backend
   event/job.
2. **Push notifications** — once a PWA/mobile app exists (Phase 12), the
   same event triggers fan out to push as well as email.
3. **In-app notification center** — a `Notification` collection per user,
   surfaced as a bell icon with an unread count, so users aren't solely
   dependent on checking email.

---

## 📊 Phase 11 — Analytics

1. **Product analytics** (PostHog/GA4/Mixpanel) — funnel tracking (browse →
   cart → checkout), page-level engagement.
2. **Business analytics (admin-facing):** revenue over time, top/most-rented/
   most-sold books, user growth, active users, membership-plan revenue
   split, seller revenue, genre popularity — computed as scheduled
   aggregation jobs feeding a small `Analytics` collection, rather than
   heavy live aggregations on every dashboard load.

---

## 🚀 Phase 12 — Future Expansion

1. **PWA first** (manifest + service worker) — cheapest path to
   installability/offline browsing before committing to native.
2. **React Native app** once the PWA validates mobile demand — reuses the
   existing API unchanged.
3. **Dark mode** — a toggle over existing Tailwind design tokens.
4. **Multi-language / multi-currency** — i18n string extraction; currency
   conversion/display based on locale, prices still stored in one base
   currency.
5. **Book exchange / donation, library management, public API, university
   partnerships, enterprise plans** — each is a natural extension once core
   commerce (Phase 2) and multi-seller inventory (Phase 5) are solid;
   revisit based on actual user demand rather than building speculatively.

---

## 🌟 Stretch Goals

1. **Gamification** (reading streaks, XP, achievements) — builds directly on
   the reading-dashboard activity log from §1.4; no new tracking
   infrastructure needed, just new badge/threshold definitions.
2. **Smart/dynamic rental pricing** — a scheduled job adjusting a book's
   `rentPrice` within admin-defined bounds based on recent demand signals
   (views, wishlist adds, rental frequency) — start with a simple rule-based
   version before reaching for a full ML model.
3. **Voice search** — see §3.8.
4. **Barcode/ISBN scanner** — device camera reads a barcode client-side
   (a barcode-scanning JS library), resolves to an ISBN, backend looks it up
   directly — no AI needed for this one, it's a solved problem via existing
   barcode libraries.
5. **Sustainability dashboard** — see §1.5.

---

## 🎓 Phase 13 — M.Tech Research & Evaluation Layer

Everything in Phases 0–12 is **engineering breadth** — real, working, production-shaped
features. That's necessary for an M.Tech project but not sufficient: a thesis/dissertation
committee evaluates **a specific contribution, measured rigorously against alternatives**,
not the size of the feature list. This phase turns one existing feature into that
contribution and wraps the rest of the system in the documentation/evidence a thesis needs.
Nothing here requires new product surface area — it's instrumentation, experiments, and
writeup on top of what's already built.

### 13.1 Choose one deep research contribution (don't spread thin)

1. The strongest candidate already in the codebase is **§3.2's hybrid search/recommendation
   engine** (structured filters + vector similarity + LLM query parsing) — it's the one
   piece that's genuinely non-trivial and has a real research literature to sit against
   (content-based filtering, collaborative filtering, hybrid/ensemble recommenders,
   LLM-augmented retrieval).
2. Reframe it explicitly as **"a hybrid recommendation architecture for a book
   rental/resale marketplace combining content embeddings, behavioral collaborative
   signals, and LLM-based query understanding, evaluated against standard IR baselines."**
3. Everything else (payments, admin portal, community features) becomes **supporting
   infrastructure** in the thesis — described in one architecture chapter, not the focus
   of the evaluation chapter. Resist the urge to claim all 12 phases as "contributions";
   one measured, defensible contribution outweighs twelve unmeasured features.

### 13.2 Formal offline evaluation framework

1. **Held-out interaction split.** Partition `UserActivity`/`Order` history chronologically
   (train on activity before date T, test on activity after T) — never a random split for
   sequential/recommendation data, since that leaks future signal into training.
2. **Baselines to implement and compare against** (each cheap — no new infra):
   - *Random* — lower bound.
   - *Popularity* — most-rented/most-bought books, no personalization.
   - *Pure content-based* — nearest neighbors in the embedding space only (no LLM
     re-ranking, no collaborative signal).
   - *Pure collaborative* — matrix-factorization or item-item co-occurrence from
     `UserActivity` alone (a small offline job — `surprise` or `implicit` in Python is
     enough, doesn't need to be productionized).
   - *Your hybrid* — the actual §3.2 pipeline.
3. **Metrics** computed per user on the held-out set, then averaged: Precision@K,
   Recall@K, NDCG@K (ranking quality), coverage (% of catalog ever recommended, guards
   against over-concentration on popular items), and diversity (average pairwise
   dissimilarity within a recommendation list).
4. **Ablation study** — remove one component at a time from the hybrid (no LLM query
   parsing; no vector similarity; no collaborative re-ranking) and report the metric drop
   for each, so the thesis can say *which* component contributes *how much*, not just that
   the combination "works."
5. Run this as an offline batch script (Node or Python, either is fine — it's an
   experiment, not a service) against a seeded/anonymized snapshot of real usage data
   accumulated during testing/demo use, output a results table + plots (matplotlib or
   Recharts) for the thesis document.

### 13.3 Lightweight online evaluation (A/B) — optional but strengthens the defense

1. If there's any real user base (classmates, friends, beta testers), randomly assign
   users to "hybrid" vs. "popularity-only" homepage recommendations via a simple
   feature-flag field on the `User` document, log click-through and wishlist/rent
   conversion per arm in the existing `UserActivity`/`Event` collections.
2. Report click-through rate and conversion rate per arm with a basic significance check
   (two-proportion z-test) — even a small sample is fine, the point is demonstrating the
   *methodology*, not claiming a large-scale result.

### 13.4 Performance & scalability benchmarking

1. **Load test the core read/write paths** (book search, checkout, AI search, chat
   assistant) with k6 or Locust — report p50/p95/p99 latency and max sustained
   requests/sec at increasing concurrency, on both a cold cache and warm Redis cache, to
   quantify the caching layer's actual impact rather than asserting it qualitatively.
2. **Query plan analysis** — run `.explain("executionStats")` on the top 5 heaviest
   MongoDB queries (search/filter/sort, homepage sections, admin analytics
   aggregations), confirm indexes are actually used, document any collection scans found
   and the index added to fix them — concrete before/after numbers are strong thesis
   evidence.
3. **Vector search latency** — separately benchmark the embedding similarity search
   (Atlas Vector Search or the in-process cosine-similarity fallback already in place per
   `CHANGES.md`) as catalog size grows synthetically (seed 1k / 10k / 50k books), since
   this is the piece most likely to show a scalability limit worth discussing.

### 13.5 Security evaluation

1. **OWASP Top 10 checklist** run against the actual app — injection (Mongoose/Zod
   already mitigate this, document how), broken auth (covered by refresh-token rotation
   in §1.1 — document the mechanism as the mitigation), sensitive data exposure (check
   what's returned in API responses vs. stored), CSRF (§9.3), rate limiting (§9.2) — a
   short table of "risk → existing mitigation → residual risk" is exactly the format
   thesis committees expect.
2. **Dependency audit** — `npm audit` on both frontend and backend, document
   findings/fixes as a point-in-time snapshot (dependencies drift, so date it).

### 13.6 System documentation for the thesis

1. **Architecture diagrams**: a component/deployment diagram (already sketched in
   `README.md`, formalize it), a full ER diagram of the MongoDB schema (Mongoose
   `SchemaDefinition` → diagram, e.g. via `mongoose-erd` or drawn manually), and
   sequence diagrams for the 2–3 most complex flows (checkout + webhook confirmation from
   §2.1, and the hybrid search/recommendation flow from §3.2).
2. **Design-decision log** — for each major architectural choice already made (Groq vs.
   OpenAI in §0, MongoDB Atlas Vector Search vs. a standalone vector DB, JWT + refresh
   rotation vs. server sessions, hybrid recommendation vs. pure collaborative filtering),
   write 3–5 sentences on the alternatives considered and why this one was chosen — this
   is what turns "I built X" into "I designed X," which is the actual M.Tech bar.
3. **Complexity analysis** — Big-O for the non-trivial algorithms (embedding similarity
   search, the taste-vector recommendation computation, the review-sentiment batching),
   stated once each, referenced from the evaluation chapter when explaining the
   benchmark results from §13.4.

### 13.7 Reproducibility package

1. **Versioned experiment configs** — every offline evaluation run (§13.2) writes its
   config (train/test split date, K values, random seed) and results to a timestamped
   file under a `experiments/` directory, so results in the thesis can be regenerated,
   not just asserted.
2. **Anonymized dataset snapshot** — export the seeded/demo `UserActivity` + `Order` +
   `Book` data used for evaluation (strip any real personal data if beta testers were
   involved) as a static JSON/CSV bundle, referenced in the thesis's "Data" section so a
   committee member could in principle rerun the evaluation.

### 13.8 Explainability for the recommendation engine

1. Alongside each recommended book, store *why* it was surfaced (matched genre
   preference / similar to book X / trending in your favourite category / collaborative
   signal from similar users) as a short tag computed at recommendation time.
2. Surface this as a small "Because..." label in the UI (cheap, reuses data already
   computed in §3.2/§1.2) and, more importantly for the thesis, report **how often each
   recommendation source ends up in a click/conversion** — this becomes another result in
   the evaluation chapter, not just a UI nicety.

### 13.9 Comparative LLM-provider study

`CHANGES.md` already shows a real substitution happened (Groq → Gemini due to an invalid
key). Turn that operational fact into a small formal comparison rather than letting it be
a footnote:
1. Run the same fixed set of tasks (query parsing, OCR extraction, review summarization)
   against Groq (Llama) and Gemini side by side, log latency and a simple accuracy/quality
   score (exact-match on structured fields for parsing/OCR; a rubric score for summaries).
2. Report cost-per-1k-requests using each provider's published pricing at evaluation time.
3. This is a small table, cheap to produce, and directly answers a question a committee
   is likely to ask anyway ("why this LLM provider?").

---

## Suggested Build Order

Given everything above, a realistic sequence that keeps the product
shippable at every step:

1. **Phase 1.1 (auth upgrade)** — foundation everything else sits on.
2. **Phase 2.1–2.2 (payments + rentals)** — makes the platform transactable.
3. **Phase 4 (admin portal)** — unblocks operating the platform day-to-day.
4. **Phase 7 partial (Redis, Cloudinary, Docker/CI)** — infra debt paid down
   before AI/community features add more surface area.
5. **Phase 3 (AI features via Groq)** — highest-leverage differentiator,
   now built on a stable, tested, payment-capable foundation.
6. **Phase 1.2–1.4 (personalization, dashboards)** — now has real usage data
   to personalize against.
7. **Phase 5, 6 (seller portal, community)** — once there's enough supply
   and demand on the platform to make them meaningful.
8. **Phase 13 (M.Tech research & evaluation layer)** — start §13.1–13.2
   (pick the contribution, build the offline evaluation harness) as soon as
   Phase 3's hybrid search/recommendation engine is stable, rather than
   leaving it for the end — the evaluation results and their write-up
   typically take longer than expected, and running §13.4's benchmarks
   needs the rest of the stack (Redis, indexes, real usage data) already in
   place. Treat it as a **parallel track alongside Phases 4–7**, not a final
   step after everything else ships.
9. Everything else opportunistically, based on real user feedback.

> **For an M.Tech submission specifically:** Phases 0–3 (core product +
> commerce + AI features) plus Phase 13 (research/evaluation) form a
> complete, defensible scope on their own. Phases 4–12 make the product
> better but don't strengthen a thesis defense the way a rigorous
> evaluation of one contribution does — prioritize accordingly if time is
> the constraint.

---

## Env Variables Referenced Above (for quick cross-check)

```
JWT_SECRET, JWT_REFRESH_SECRET
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET   # webhook secret to add
STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET
CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
GROQ_API_KEY, GROQ_TEXT_MODEL, GROQ_VISION_MODEL                 # replaces OPENAI_API_KEY
EMBEDDING_PROVIDER, <EMBEDDING_PROVIDER>_API_KEY                 # to add once §3.2 is built
REDIS_URL
MONGO_URI
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
SESSION_SECRET                                                   # to add for OAuth flows
FRONTEND_URL, BACKEND_URL                                        # to add for OAuth redirects + CORS
GEMINI_API_KEY, GEMINI_TEXT_MODEL, GEMINI_EMBEDDING_MODEL        # in use as the Groq fallback; needed either way for §13.9's comparison
``` -->