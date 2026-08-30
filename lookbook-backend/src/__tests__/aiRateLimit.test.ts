import request from "supertest";
import { createApp } from "../app";

// The test is about the RATE LIMITER, not the AI provider. With a real
// GEMINI_API_KEY in .env each request would make a live API call (23 ×
// network latency > the 30s test timeout) and would be non-deterministic
// against the public API. Mocking keeps it offline and instant.
jest.mock("../utils/ai", () => ({
  generateJson: jest.fn().mockResolvedValue(null),
}));
jest.mock("../utils/embeddings", () => ({
  generateEmbedding: jest.fn().mockResolvedValue(null),
  cosineSimilarity: jest.fn(() => 0),
}));

const app = createApp();

describe("AI endpoint rate limiting", () => {
  it("throttles the ai-search endpoint after 20 requests per minute", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 23; i += 1) {
      const res = await request(app).get("/api/books/ai-search").query({ q: "adventure stories" });
      statuses.push(res.status);
    }

    const throttled = statuses.filter((s) => s === 429).length;
    // aiLimiter allows 20/min — 21st request onward should be rejected.
    expect(throttled).toBe(3);
    expect(statuses[0]).toBe(200);
    expect(statuses[19]).toBe(200);
  });
});