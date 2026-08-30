// §13.4.1 — load test: AI search path (GET /api/books/ai-search).
//
// Usage:
//   k6 run --vus 10 --duration 30s benchmarks/k6/ai-search.js
//
// AI search is rate-limited to 20 req/min per IP (`aiLimiter`), so keep the
// load modest or you'll measure the 429 path, not the search. p50/p95/p99
// here include the LLM query-parse + vector re-rank latency — a useful
// contrast against the plain catalog search benchmark.
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE_URL || "http://localhost:5000/api";

export const options = {
  vus: __ENV.VUS || 5,
  duration: __ENV.DURATION || "20s",
};

export default function () {
  const queries = [
    "science fiction under 300",
    "romance with a happy ending",
    "history books about india",
    "horror novels",
  ];
  const q = queries[Math.floor(Math.random() * queries.length)];
  const res = http.get(`${BASE}/books/ai-search?q=${encodeURIComponent(q)}`);
  check(res, { "status is 200 or 429": (r) => r.status === 200 || r.status === 429 });
  sleep(1.5);
}
