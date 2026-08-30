# §13.6.1 — System Architecture

LookBook is a three-tier web application: a React (Vite) single-page
application, an Express (TypeScript) REST API, and MongoDB Atlas. Redis Cloud
backs caching and the BullMQ job queue.

```
┌──────────────────┐     HTTPS      ┌─────────────────────────────────────────────┐
│ React SPA        │ ─────────────▶ │ Express API (lookbook-backend)              │
│ (Vite)           │  JSON / SSE    │                                             │
│                  │                │  Auth (JWT+refresh, CSRF, 2FA, sessions)    │
│  Pages / Hooks   │                │  Controllers ── Services ── Mongoose models │
│  Contexts        │                │  Middleware: helmet, rate-limit, sanitizer  │
│  RouteTracker    │                │  AI layer: utils/ai.ts, utils/embeddings.ts │
└──────────────────┘                │  Jobs: BullMQ (notifications, pricing)      │
                                    │                                             │
                                    └──────┬──────────────────────┬───────────────┘
                                           │                      │
                                    ┌──────▼──────┐        ┌──────▼──────┐
                                    │ MongoDB     │        │ Redis Cloud │
                                    │ Atlas       │        │ cache/queue │
                                    └──────▲──────┘        └─────────────┘
                                           │
                              ┌────────────┴─────────────┐
                              │ 3rd-party services        │
                              │ • Gemini (text/embed)     │
                              │ • Groq (text; key invalid)│
                              │ • Open Library (import)   │
                              │ • Razorpay/Stripe (pay)   │
                              │ • FCM/WebPush (notify)    │
                              └──────────────────────────┘
```

## Components

- **Frontend** — React 19 + Vite, Tailwind, react-router. Domain state in
  React Contexts (auth, cart, wishlist) with a localStorage cache and a
  server sync. Client-side analytics tracker (`utils/analytics.ts`) fires
  `navigator.sendBeacon` events (incl. §13.8 recommendation events) to
  `POST /api/analytics/track`.
- **API** — Express; controllers are thin, business logic lives in
  `src/utils/` and the AI layer in `src/utils/ai.ts` + `src/utils/embeddings.ts`.
  The §3.2 hybrid recommendation pipeline is composed in
  `controllers/homepageController.ts` (structured slots) and
  `controllers/aiSearchController.ts` (query parse → hard filters → vector rank).
- **Data** — MongoDB Atlas. `Book.embedding` (768-d, Gemini text-embedding) is
  stored with `select: false` and included only for the similarity paths.
- **Cache** — Redis `homepage:<userId>` (TTL 1h), `getCache`/`setCache`
  (`config/redis.ts`). Pure optimization by design: every call is wrapped in
  try/catch and checks `redis.status === "ready"` first, so a down/unreachable
  Redis just means every request falls through to a live recompute — no
  in-memory fallback cache, no TTL jitter, the app is simply slower, never
  broken. *(Corrected 2026-08-27 — the previous wording described a
  `safeCache` in-memory-Map fallback and TTL jitter that don't exist in the
  code; verified against `config/redis.ts`.)*
- **Async work** — BullMQ queues (notifications, automated pricing, snapshots).

## Key flows (condensed)

1. **Book search** — `GET /api/books` → `ApiFeatures` (regex search, filters,
   sort, paginate) → cached count + page → SPA.
2. **AI search** — `GET /api/books/ai-search` → `generateJson` parses the query
   into `{category, maxPrice, minRating, keywords}` → hard MongoDB filter →
   `generateEmbedding(query)` → cosine re-rank within the qualifying set →
   results.
3. **Homepage** — `GET /api/homepage` → §13.3 arm (`hybrid`|`popularity`)
   lazily assigned per user → sections built (content/collaborative/popularity
   for `hybrid`; global-popularity for the control) → Redis cache → SPA
   renders rows, fires `recommendation_view`, per-card reasons (§13.8).
4. **Recommendation attribution** — card click → `recommendation_click`
   (`bookId, arm, section, reason`) → same-session conversion events
   (`wishlist_add`, `add_to_cart`, …) → §13.3 report in admin.

## Deployment

Two independent processes (`lookbook-backend`, `lookbook-frontend`), each with
its own `package.json`. Vite dev proxies `/api` to :5000; production serves
the built SPA behind the same origin.