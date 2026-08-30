# §13.6.3 — Sequence Diagrams

Mermaid sequence diagrams for the four highest-value flows. These are the
flows the evaluation layer (§13.2–13.4) measures, so each diagram notes where
the measurement hooks in.

## 1. Hybrid recommendation serving + attribution (§13.3 / §13.8)

```mermaid
sequenceDiagram
    participant U as User (SPA)
    participant F as Homepage controller
    participant R as Redis
    participant M as MongoDB
    participant G as Gemini

    U->>F: GET /api/homepage
    F->>M: load user.recommendationArm (lazy random if unset)
    F->>R: cache hit?  (homepage:<userId>, TTL 1h)
    alt cache miss
        F->>M: recent UserActivity + wishlist
        F->>G: taste/seed embeddings (hybrid arm only)
        F->>M: findSimilarByVector (vector rank)
        F->>F: compose sections + reasons map (§13.8)
        F->>R: cache payload
    end
    F-->>U: { arm, reasons, sections }
    U->>U: fires recommendation_view {arm, section, bookIds}
    U->>F: POST /api/analytics/track (sendBeacon)
    U->>F: card click → recommendation_click {arm, section, reason, bookId}
    Note over F,M: §13.3 report = same-session conversion on clicked book
```

## 2. AI search (query parse → hard filter → vector rank)

```mermaid
sequenceDiagram
    participant U as User
    participant C as aiSearch controller
    participant M as MongoDB
    participant G as Gemini

    U->>C: GET /api/books/ai-search?q="sci-fi under 500"
    C->>M: valid category names
    C->>G: generateJson(query) → {category, maxPrice, keywords}
    C->>G: generateEmbedding(query)
    alt hard constraints present
        C->>M: Book.find({category, rentPrice≤500})
        C->>C: cosine re-rank within set → top 12
    else pure vibe query
        C->>M: findSimilarByVector(embedding, limit 12)
    end
    C-->>U: { results, interpretedAs }
```

## 3. Checkout + payment verification + webhook confirmation (write path used
   by the k6 checkout benchmark)

*(Corrected 2026-08-27 — the previous version showed a single synchronous
checkout that decremented stock inline; the real code deliberately splits
order creation from payment confirmation and never trusts a client-only
"it succeeded" claim, per the comment at `orderController.ts:57-59`.)*

```mermaid
sequenceDiagram
    participant U as User (SPA)
    participant C as Order controller
    participant M as MongoDB
    participant P as Razorpay/Stripe
    participant W as Webhook endpoint

    U->>C: POST /api/orders/checkout {address, provider}
    C->>M: load user+cart, check overdue-rental block
    C->>M: create Order (status:Placed, paymentStatus:pending)
    C->>P: create Razorpay order / Stripe Checkout session
    C->>M: save order.paymentProvider + provider order/session id
    C-->>U: { order, provider payment-init data }

    U->>P: completes payment in Razorpay/Stripe UI

    par client-side confirmation (fast path)
        U->>C: POST /api/orders/:id/verify-payment
        C->>P: verify HMAC signature (Razorpay) / retrieve session (Stripe)
        alt signature/session valid
            C->>C: finalizePaidOrder(order) — idempotent
            C->>M: paymentStatus=paid, decrement stock, clear matching cart items,
            Note over C,M: set rental dueDate, logActivity, notify(), email
            C-->>U: order confirmed
        else invalid
            C->>M: paymentStatus=failed
            C-->>U: 400 "payment verification failed"
        end
    and provider webhook (defense-in-depth, authoritative)
        P->>W: POST /api/webhooks/{razorpay|stripe} (signed, raw body)
        W->>W: verify HMAC over req.rawBody (captured by express.json verify hook)
        alt signature valid + event is payment-captured/checkout-completed
            W->>M: find Order by provider order/session id
            W->>C: finalizePaidOrder(order) — same idempotent function
            Note over C,M: no-op if already paid — whichever path (verify-payment or webhook) lands first wins
        else invalid signature
            W-->>P: 401
        end
    end
```

**Why both paths call the same `finalizePaidOrder`:** the client-side
`verify-payment` call gives the buyer instant confirmation without waiting on
the provider's webhook ping, while the webhook is the authoritative
confirmation that doesn't depend on the buyer's browser staying open. Both
paths converge on one idempotent function (`if (order.paymentStatus ===
"paid") return;`), so whichever fires first does the real work and the other
is a safe no-op — this is what prevents double stock-decrement or a
duplicate confirmation email if both happen to fire.

**Local-dev caveat (documented in code):** the Razorpay/Stripe webhook path
is unexercised in this environment — the providers can't call back to
`localhost`, so only the client-verify path has actually been run here. This
is called out explicitly rather than left implicit, since a diagram showing
both paths could otherwise read as "both were tested."

## 4. Offline evaluation run (§13.2)

```mermaid
sequenceDiagram
    participant S as npm run eval:recommendations
    participant E as evaluate/* modules
    participant X as experiments/<run-id>/

    S->>E: loadDataset (Mongo) or load snapshot JSON
    E->>E: chronological split (train < splitDate ≤ test)
    loop each strategy (baselines + hybrid + ablations)
        E->>E: build recs from train, score vs test (P@K/R@K/NDCG/coverage/diversity)
    end
    E->>X: config.json, results.csv/json, report.md (+SVG charts)
```