# §13.5.2/3 — Setup-from-Scratch & Seed-Data Versioning

**Date:** 2026-08-18 · re-verified 2026-08-27 (seed script behavior confirmed
against source; §5 updated — see below)

A clean machine → fully running LookBook stack, documented step by step so the
project can be handed off or redeployed without tribal knowledge. Verified
against the repo state as of this date (Node ≥ 18, see `engines`).

## 0. Prerequisites

- **Node.js ≥ 18** (`node -v` to check)
- **npm** (ships with Node)
- **MongoDB Atlas** cluster (the project runs on Atlas cloud — no local
  `mongod` needed) — create at https://cloud.mongodb.com and whitelist the
  machine's IP (the cluster is unreachable otherwise)
- **Redis** — *optional*. `config/redis.ts` treats Redis as a pure cache
  optimization; if `REDIS_URL` is empty or unreachable the app works
  identically, just without the homepage cache.
- **External service keys** — optional until the related feature is used
  (see §13.6 for the current credential state): Gemini (`GEMINI_API_KEY`),
  Groq (`GROQ_API_KEY`), Cloudinary, Razorpay, Stripe, Brevo SMTP, OAuth apps.

## 1. Backend

```bash
cd lookbook-backend
npm install
cp .env.example .env        # then fill in every <placeholder> (never commit real values)
npm run seed                # deterministic catalog + demo admin (see §3)
npm run dev                 # API on http://localhost:5000
```

`npm run seed` wipes and re-inserts `Book`, `Category`, `Plan` from the
checked-in fixtures in `src/data/` and upserts the demo admin:

```
email:    admin@lookbook.dev
password: Admin@12345
```

## 2. Frontend

```bash
cd lookbook-frontend
npm install
# .env.example already points at the local API; no change needed for local dev
npm run dev                 # Vite dev server on http://localhost:5173
```

The frontend uses `VITE_API_URL` (default `http://localhost:5000/api`) for all
API calls and reads the backend cookie for auth.

## 3. Seed-data versioning (§13.5.3)

Two layers, both versioned:

1. **The demo catalog is code.** `src/data/seedBooks.ts`, `seedCategories.ts`,
   `seedPlans.ts` are checked in, so `npm run seed` deterministically restores
   the same known-good demo state on demand — "whatever seeding produces
   today" is the same as what it produced on any previous day.
2. **The live/evaluated data snapshot is JSON.** `npm run export:dataset`
   (`src/scripts/evaluate/exportDataset.ts`) exports the *current* catalog +
   anonymized user interactions to `experiments/dataset/*.json` (user ids
   replaced with opaque `u1, u2, …` labels — no PII). That snapshot can be
   restored into offline evaluation runs with
   `npm run eval:recommendations -- --snapshot <file>`, giving a reproducible
   number for a specific data state.

Optional catalog growth + AI enrichment (all repeatable):

```bash
npm run import:books      # pull real books from Open Library (keyless), embeddings only
npm run embed:books       # backfill embeddings for books that lack one (needs GEMINI_API_KEY)
npm run summarize:books   # backfill AI summaries (needs an AI key)
```

## 4. Verify

```bash
cd lookbook-backend && npm run lint && npm test     # ESLint + Jest
cd lookbook-frontend && npm run build && npm test   # tsc + Vite build + Vitest
```

## 5. Not verified here (needs real infra)

- **Docker + CI, actually run** — `Dockerfile`/`docker-compose` and the
  GitHub Actions workflow still haven't executed for real anywhere (no
  Docker daemon, no git remote in this environment as of 2026-08-27 either).
  What *has* been done here as a substitute: (a) both Dockerfiles and
  `.dockerignore` files reviewed line-by-line — build stages match
  `tsconfig.json`'s `outDir`, `CMD` matches the `start` script, `.env` is
  correctly excluded from the build context in both apps; (b) every step the
  CI workflow runs (`npm run lint`, `tsc --noEmit`/`tsc -b`, `npm test`) was
  run locally exactly as written — backend lint 0 errors/5 known warnings,
  tsc clean, Jest 26/26; frontend lint clean, tsc clean, Vitest 14/14. This
  confirms the workflow itself is correct, not just present — the only
  remaining gap is actually triggering it via `docker compose up --build`
  and a real `git push`, which needs a Docker host and a git remote this
  environment doesn't have. Tracked in `phase-13-status.md`.
- **Lighthouse baseline** — done (2026-08-27, superseding this note): a
  `npm run dev` run scored Performance 55, which turned out to be a known
  Vite dev-mode artifact; a production build (`vite preview`) gave
  Performance 83 / LCP 2.9s. See `docs/thesis/performance-load-testing.md`.