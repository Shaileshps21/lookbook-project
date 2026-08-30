// §13.4.1 — load test: book search / catalog read path.
//
// Usage:
//   k6 run --vus 20 --duration 30s benchmarks/k6/book-search.js
//
// Reports p50/p95/p99 latency and max sustained req/s for GET /api/books
// (search + category filter + sort + pagination). Run once with a warm Redis
// cache (hit the endpoint a few times first) and once cold to quantify the
// caching layer's impact — that comparison is the thesis evidence.
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const BASE = __ENV.BASE_URL || "http://localhost:5000/api";
const errorRate = new Rate("errors");

export const options = {
  vus: __ENV.VUS || 20,
  duration: __ENV.DURATION || "30s",
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% of requests under 500ms
    errors: ["rate<0.05"],
  },
};

export default function () {
  const queries = [
    { search: "asimov", category: "", sort: "rating" },
    { search: "", category: "Fiction", sort: "popular" },
    { search: "", category: "", sort: "newest", limit: "12" },
    { search: "caves", category: "", sort: "price-asc" },
  ];
  const q = queries[Math.floor(Math.random() * queries.length)];
  const params = Object.entries(q)
    .filter(([, v]) => v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const res = http.get(`${BASE}/books?${params}`);
  check(res, { "status is 200": (r) => r.status === 200 });
  errorRate.add(res.status !== 200);
  sleep(0.1);
}
