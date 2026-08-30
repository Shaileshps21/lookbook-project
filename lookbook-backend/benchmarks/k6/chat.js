// §13.4.1 — load test: AI chat assistant (SSE stream).
//
// Usage:
//   k6 run --vus 3 --duration 20s -e ACCESS_TOKEN="eyJ..." benchmarks/k6/chat.js
//
// The assistant endpoint requires a logged-in user and streams tokens over
// SSE, so the natural metric is p50/p95/p99 for the first-byte / full-response
// time rather than raw req/s. Keep VUs low — each stream ties up a Gemini
// generation and there is no rate limit on this route yet.
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE_URL || "http://localhost:5000/api";
const TOKEN = __ENV.ACCESS_TOKEN;

export const options = {
  vus: __ENV.VUS || 3,
  duration: __ENV.DURATION || "15s",
};

export default function () {
  if (!TOKEN) {
    throw new Error("Set -e ACCESS_TOKEN=<jwt> to run the chat benchmark");
  }
  const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
  const res = http.post(
    `${BASE}/assistant/chat/stream`,
    JSON.stringify({ messages: [{ role: "user", content: "Recommend me a science fiction book" }] }),
    { headers }
  );
  check(res, { "stream opened": (r) => r.status === 200 });
  sleep(3);
}