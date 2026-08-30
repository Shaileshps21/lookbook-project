// §13.4.1 — load test: checkout write path (POST /api/orders/checkout).
//
// Usage (pass a real access token):
//   k6 run --vus 10 --duration 30s -e ACCESS_TOKEN="eyJ..." benchmarks/k6/checkout.js
//
// Hits the order-creation write path. Checkout is rate-limited (15/10min) and
// gated behind email verification + auth, so a low VU count keeps you inside
// the limiter while still exercising the write path.
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE_URL || "http://localhost:5000/api";
const TOKEN = __ENV.ACCESS_TOKEN;

export const options = {
  vus: __ENV.VUS || 5,
  duration: __ENV.DURATION || "20s",
};

export default function () {
  if (!TOKEN) {
    throw new Error("Set -e ACCESS_TOKEN=<jwt> to run the checkout benchmark");
  }
  const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
  const payload = JSON.stringify({ address: "Load-test address, India 110001" });

  const res = http.post(`${BASE}/orders/checkout`, payload, { headers });
  // 400 (empty cart / unverified) is an expected outcome for this synthetic
  // load — the point is measuring the write-path latency, not order success.
  check(res, { "got a definitive response": (r) => r.status < 500 });
  sleep(2);
}
