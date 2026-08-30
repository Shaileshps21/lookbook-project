# §13.4.1 — Load testing with k6

The thesis's performance chapter needs measured p50/p95/p99 latency and max
sustained requests/sec on the core read/write paths, not a qualitative claim
that "it's fast." k6 (https://k6.io) is a free, scriptable load runner that
installs as a single binary — no service to host.

## Install

```bash
# any of:
winget install k6   # Windows
brew install k6     # macOS
snap install k6     # Linux
# or: curl -s https://k6.io/install.sh | bash
```

## Start the stack first

```bash
cd lookbook-backend && npm run dev
```

## Run a benchmark

```bash
# Catalog read path (no auth)
k6 run --vus 20 --duration 30s benchmarks/k6/book-search.js

# AI search (rate-limited to 20 req/min/IP — keep VUs low)
k6 run --vus 5 --duration 20s benchmarks/k6/ai-search.js

# Checkout write path (needs a real JWT from a logged-in user)
k6 run --vus 5 --duration 20s -e ACCESS_TOKEN="<jwt>" benchmarks/k6/checkout.js

# Chat assistant SSE (needs a JWT)
k6 run --vus 3 --duration 15s -e ACCESS_TOKEN="<jwt>" benchmarks/k6/chat.js
```

## Capturing the cold vs. warm cache comparison (§13.4.1)

The whole point is quantifying the Redis caching layer:

1. **Cold cache** — restart the backend (`npm run dev`), then immediately run
   a benchmark. Every request is a cache miss and hits MongoDB.
2. **Warm cache** — after the cold run, hit the same URLs a few times manually
   (or let the benchmark's own traffic warm it), then re-run.

Record both runs' `http_req_duration` summary (p50/p95/p99) and
`http_reqs` (max sustained req/s) side by side in a table. That before/after
pair is the evidence the evaluation chapter wants.

## Expected notes

- `checkout.js` and `chat.js` need `ACCESS_TOKEN`; checkout is also gated by
  email verification and a 15/10-min rate limit, so treat it as a write-path
  *latency* probe, not a throughput test.
- `ai-search.js` may legitimately return 429s once the per-IP limiter trips —
  that's the rate limiter doing its job; the threshold check tolerates it.

## Where results go

k6 prints the summary to stdout. Save it with:

```bash
k6 run --out json=experiments/benchmark/load-$(date +%F-%H%M).json ...
```

(adjust paths relative to `lookbook-backend/`), then drop the table into
`docs/thesis/` alongside the other evaluation evidence.