# 📚 LookBook v2.0 — Future Roadmap & Implementation Flow

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
8. Everything else opportunistically, based on real user feedback.

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
```
