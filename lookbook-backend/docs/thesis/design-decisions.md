# §13.6.4 — Design-Decision Log

Chronological log of the decisions that shaped the recommendation/AI
architecture — recorded *why*, because the code only records *what*.

| # | Decision | Rationale | Alternatives rejected | Evidence |
|---|---|---|---|---|
| D1 | Embeddings stored on the `Book` doc (`select: false`), not a sidecar collection | One hop to fetch vector + metadata for similarity scans; `$vectorSearch` can still index the same field | Separate vector DB / pgvector | `models/Book.ts`, `utils/vectorSearch.ts` |
| D2 | AI-search parses the query into *hard* constraints, then ranks within the set | "under ₹500" is a hard budget; vector similarity must not override a stated constraint | Pure vector retrieval for everything | `controllers/aiSearchController.ts` |
| D3 | Hybrid recommendation = content vector similarity + item-item co-occurrence + popularity prior | The §3.2 thesis contribution; the offline eval (§13.2) confirms each signal contributes | Content-only or popularity-only | `homepageController.ts`, `baselines.ts` |
| D4 | `recommendationArm` has **no schema default**; assigned lazily on first homepage fetch | Mongoose applies defaults on read, which would give *every* existing user the same arm instead of randomizing them | Schema default `"hybrid"` | `models/User.ts`, `homepageController.ts:ensureArm` |
| D5 | AB attribution is client-generated `sessionId` + optional `user` id; no server-side session cookie | Anonymous, PII-free (§11.1), works for logged-out visitors, zero infra | Server-side session store | `utils/analytics.ts`, `analyticsController.ts` |
| D6 | Conversion = same-session wishlist/cart/checkout on a *clicked* book | Impressions → clicks → conversion is the cleanest causal chain per book | Per-impression conversion (noisy) | `utils/abStats.ts` |
| D7 | AB endpoint + offline CLI share `computeAbReport` | The two can never drift (they answer the same question from different data sources) | Duplicate logic | `utils/abStats.ts`, `evaluate/abReport.ts` |
| D8 | `GEMINI_TEXT_MODEL` is env-driven | §13.9 provider study needs to run the same tasks through different models without code edits | Hardcoded model string | `config/env.ts`, `utils/ai.ts`, `.env.example` |
| D9 | Offline eval reads a versioned JSON snapshot (anonymized) *or* live MongoDB | Reproducibility package (§13.7) must run without the live DB or credentials | Live-DB-only evaluation | `evaluate/dataset.ts`, `exportDataset.ts` |
| D10 | `explain("executionStats")` benchmark runs the *actual* app query shapes | Before/after numbers (index vs COLLSCAN) are the thesis evidence, not a synthetic query | Generic benchmark suite | `benchmark/queryPlans.ts` |
| D11 | Rate-limiter test mocks the AI layer | The test asserts the *limiter*, not the provider; live Gemini calls made it slow and non-deterministic | Hitting real APIs in CI | `__tests__/aiRateLimit.test.ts` |

## Explicit non-decisions (deferred)

- Switching back to Groq once the API key is regenerated (D8 makes it a
  one-line config change; see `utils/ai.ts`).
- Adding a real A/B experimentation framework (GrowthBook/LaunchDarkly) — the
  in-house arm flag + z-test report is sufficient for the thesis scale.
- Database-level vector index for the cosine fallback path — the Atlas
  `$vectorSearch` aggregation is the production path; the in-process fallback
  is measured (§13.4.3) but not indexed.

## Platform design decisions (§13.4.2)

The five choices below predate the thesis layer; they are recorded here so a
new contributor sees *why the system is shaped the way it is*.

| Decision | Rationale | Alternatives rejected |
|---|---|---|
| **Groq + Gemini dual AI provider (§A.0)** | The AI layer is a thin provider-agnostic adapter (`utils/ai.ts`): text completion, JSON completion and vision each resolve a provider from env. This is *why* the Groq outage never took the AI features down — the same requests failed over to Gemini without a redeploy. Groq was picked for price/latency on completion-heavy tasks; Gemini picked for embeddings (`gemini-embedding-001`, 768-d) and as the always-working fallback. | A single locked-in provider (OpenAI-only was the original idea and was dropped for cost); per-feature hardcoded providers. |
| **MongoDB Atlas Vector Search + in-process cosine fallback (§A.3.2)** | Embeddings already live on `Book` docs; Atlas `$vectorSearch` is the production path (no extra infra, no data movement), and the in-process cosine fallback keeps the demo reproducible locally and offline. | A standalone vector DB (Pinecone/pgvector) — extra infra and a second source of truth for no latency win at this catalog size. |
| **JWT access + rotating refresh tokens (§A.1.1)** | Stateless access tokens with 7-day expiry keep API auth cheap and horizontally scalable; refresh tokens are stored hashed server-side (`RefreshToken` model), rotated on every use, and revocable — giving the session-revocation power of server sessions without pinning auth to one instance. | Plain server sessions (memory/Redis) for everything — fine for a monolith, but the API + PWA split and future multi-instance deployment make stateless access tokens the safer default. |
| **Dual payment provider: Razorpay + Stripe (§A.2.1)** | Razorpay covers the primary IN/international-UPI market with zero extra setup; Stripe is the fallback for cards/international. Payment webhooks are signature-validated per provider. The dual path is cheap insurance against a provider-side outage or regional block, and both were exercised in smoke tests. | A single provider (cheaper to maintain, but a single point of failure for revenue). |
| **Self-hosted event tracking (§A.11)** | Every analytics event is a document in the local `Event` collection with a client-generated `sessionId` — no cookies beyond the auth cookie, no third-party script, PII-free, and the same data powers the AB report (§13.1) and the offline eval snapshots. | External analytics SaaS (GA/PostHog/Amplitude) — introduces a third party into the auth/attribution loop, leaks behavioral data, and makes offline reproducibility harder. |

## Frontend awareness of arm assignment (§13.1, decided)

Arm assignment is **served transparently from the backend**: the homepage
payload includes `arm` + per-book `reasons`, and the frontend uses them only
for *attribution* (tagging `recommendation_view`/`recommendation_click` events)
and *display* (the reason badge). There is **no frontend behavioral branching**
— a user never sees a different UI or feature set based on their arm, so the
A/B test measures the recommendation pipeline, not UI differences. This is the
decision the roadmap flagged as "likely not needed"; confirmed as not needed.