# LookBook Project Summary

## Project Overview
**LookBook** is a full-stack book marketplace (rent/buy/sell) with:
- **Frontend**: React 19 + TypeScript + Vite + Tailwind + Framer Motion (`lookbook-frontend/`)
- **Backend**: Express + TypeScript + MongoDB/Mongoose + JWT auth (`lookbook-backend/`)


---

## Complete Project History (Phases 0–13)

| Phase | Focus | Status |
|-------|-------|--------|
| **Phase 1** | Production-ready core (auth, JWT, refresh rotation, email verification, OAuth, AI homepage personalization) | ✅ Complete |
| **Phase 2** | Commerce (Razorpay integration, rental lifecycle, address book) | ✅ Complete |
| **Phase 3** | AI Features (chat assistant, OCR, duplicate detection, cover quality, voice) | ✅ Complete |
| **Phase 4** | Admin Portal (dashboard, seller approval, book CRUD, order management) | ✅ Complete |
| **Phase 5** | Seller Portal (listings, inventory, payouts, revenue) | ✅ Complete |
| **Phase 6** | Community (follows, shelves, public profiles, book clubs, challenges) | ✅ Complete |
| **Phase 7** | Performance/Infra (Redis caching, BullMQ, Cloudinary, pagination, indexing) | ✅ Complete |
| **Phase 8** | Testing (Jest 21/21, Vitest 14/14, Playwright 6/6) | ✅ Complete |
| **Phase 9** | Security (rate limiting, CSRF, 2FA, audit logs) | ✅ Complete |
| **Phase 10** | Notifications (email, in-app, push — PWA-ready) | ✅ Complete |
| **Phase 11** | Analytics (business snapshots, product events) | ✅ Complete |
| **Phase 12** | Future Expansion (PWA basics, dark mode) | ✅ Complete |
| **Phase 13** | Experimentation & Hardening (A/B testing, load testing, security audit, docs, deployment) | 🔄 **In Progress** |

---

## Key Recent Achievements

### 2026-08-28 (Latest Session)
- Tested the running app live in Chrome (real clicks, not just code reading)
  and found 4 real bugs, fixed 3: (1) CORS silently blocked every API call
  because `.env`'s `CLIENT_URL` didn't match the port Vite actually landed
  on (another local project held the default port) — fixed; (2) dark mode
  was a non-functional stub touching ~700+ untokenized color classes with
  no shared theme system — disabled by agreement with the user rather than
  a risky blind mass-edit, full dark mode left for a dedicated future task;
  (3) `errorHandler.ts` leaked raw internal error text (a MongoDB error
  exposing a server file path) straight into the registration UI — fixed
  to always use a generic message for unrecognized errors; (4) the profile
  page's "Reviews Given" stat was hardcoded to `3` for every user — fixed
  with a new `GET /api/users/me/stats` endpoint wired to real data
- Full write-up: `CHANGES.md` (2026-08-28 entry)

### 2026-08-27
- §13.5 Deployment & Reproducibility: no Docker daemon/git remote here
  (user deploying separately later), so did the closest substitute —
  reviewed both Dockerfiles + `.dockerignore` line-by-line (no secrets-leak
  risk, build paths correct), then ran every CI workflow step locally
  exactly as written for both apps, all passing (backend Jest 26/26,
  frontend Vitest 14/14, clean lint/typecheck) — confirms the CI workflow
  itself is correct, only a git remote is missing to trigger it for real.
  Verified backend tests need no CI secrets/services (in-memory Mongo,
  Redis disabled). Re-ran `export:dataset` live — still works
- §13.4 Architecture Docs: re-verified all 4 docs against actual code —
  found and fixed real drift in 3 of them. ER diagram was missing 2 real
  collections (`Plan`, `Shelf`) and had 3 fake entities that don't
  correspond to any collection; architecture doc said "React 18" (actual:
  19) and described a caching mechanism (`safeCache`, TTL jitter) that
  doesn't exist in the code; the checkout sequence diagram showed a
  synchronous flow when the real code splits order creation from payment
  confirmation across a client-verify path and an idempotent webhook
  handler — rewritten to match, including the webhook confirmation the
  roadmap asked for that no diagram had. Design-decision log and the other
  2 sequence diagrams held up unchanged
- §13.3 Security Review: re-verified all 3 items (dependency audit, secrets
  hygiene, OWASP checklist) live against the running app rather than trusting
  the existing "done" status — dependency counts unchanged (backend 2 high
  dev-only, frontend 0), no hardcoded secrets found, and empirically
  confirmed webhook signature verification, `sanitizeUser` field allowlisting,
  and the auth rate limiter (25 rapid logins → 401×20 then 429) all actually
  work as documented. Open items (eslint-toolchain bump, fuzz testing,
  webhook content-type hardening) remain open, flagged for the user
- Picked up Phase 13 at §13.2 (Performance & Load Testing) — the next
  unstarted track after §13.1
- Found & fixed 3 tooling bugs that had prevented every prior benchmark/k6
  run from producing a real number (Mongoose model binding, k6's missing
  `URLSearchParams`, wrong chat request shape)
- Ran query-plan analysis live: all IXSCAN, no COLLSCANs
- Ran vector-search latency at 1k catalog size (p50 2.16s/p95 5.46s);
  10k/50k blocked by an Atlas write hang (20+ min, no progress)
- Ran k6 load tests on all 4 core paths; found `/api/books` degrades from
  270ms solo to 2.08s avg under 20 concurrent users, and even a Redis
  cache-hit read took 3.5–4.2s — reads as network latency to the remote
  Atlas/Redis Cloud endpoints, not an app bug (flagged for re-measurement
  from infra closer to the DB)
- Ran Lighthouse against a production build (not just dev mode): Performance
  83, LCP 2.9s — the dev-server run's Performance 55 is a known Vite
  dev-mode artifact, not a real baseline
- Full write-up: `lookbook-backend/docs/thesis/performance-load-testing.md`

### 2026-08-20
- Verified Phase 13.1 (recommendation A/B experimentation) end-to-end in Chrome
- Added 2 new Playwright e2e tests (total: 6 → 8)
- A/B arms: `hybrid` (personalized) vs `popularity` (control) with explainability badges
- Attributed analytics: `recommendation_view`/`recommendation_click` + conversion chaining
- Admin AB report panel with z-test and per-source breakdown

### 2026-08-18 (Hotfix + Phase 13)
- Fixed 13 broken book cover images (legacy static paths → real Open Library covers)
- Fixed `export:dataset` bug (lean docs use `_id` not `id`)
- Added MongoDB indexes for homepage queries (COLLSCAN → IXSCAN)
- Rewrote `UPDATED_FUTURE.md` into Part A (as-built) + Part B (Phase 13)

### 2026-08-15/16
- Stripe checkout end-to-end on frontend
- ISBN barcode scanner for sellers (@zxing/library)
- Public API docs page (`/developers`)
- Roadmap reconciliation (logged previously-untracked features)

### 2026-08-07
- Removed static book covers (`public/books/`) → gradient placeholders
- Verified API-only catalog (no hardcoded book data)
- Fixed BullMQ/Redis connection sharing bug (dedicated connections per queue/worker)

---

## Test Status (as of 2026-08-20)

| Suite | Tests | Status |
|-------|-------|--------|
| Backend Jest | 26 | ✅ 26/26 |
| Frontend Vitest | 14 | ✅ 14/14 |
| Playwright E2E (Chrome) | 8 | ✅ 8/8 |
| TypeScript (both) | — | ✅ Clean |
| ESLint (both) | — | ✅ Clean |

---

## Known Deferred Items (Blocked on External Credentials/Infra)
- Groq API key (currently using Gemini fallback)
- Cloudinary credentials (image upload blocked)
- Google OAuth redirect URI (needs console config)
- Stripe keys (UI hidden when unavailable)
- Shiprocket, Sentry, PostHog/GA4, Docker/CI verification
- Lighthouse baseline, live k6 load tests

---

## Architecture Highlights
- **Degrade-gracefully design**: every external integration fails softly via capability checks
- **Provider-agnostic AI layer**: Groq/Gemini swappable via env (embeddings always needed second provider)
- **Real data only**: no mock data in frontend; 185 real books from Open Library
- **JWT + httpOnly refresh + CSRF** with atomic rotation
- **BullMQ workers** with dedicated Redis connections (fixed reliability)

---

## Project Structure
```
lookbook-project/
├── lookbook-frontend/    # React + Vite + Tailwind + Framer Motion
├── lookbook-backend/     # Express + TypeScript + MongoDB (Mongoose) + JWT
├── CHANGES.md            # Complete development log
├── UPDATED_FUTURE.md     # Architecture docs + Phase 13 roadmap
├── README.md             # Setup & usage instructions
├── docker-compose.yml    # Docker config (Mongo + API)
└── summary.md            # This file
```