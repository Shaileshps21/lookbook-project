import fs from "fs";
import path from "path";
import "dotenv/config";

/**
 * §13.9 — Comparative LLM-provider study.
 *
 * Runs the same fixed task set against Groq (Llama) and Gemini side by side,
 * logging latency and a simple quality score per provider, then reports
 * cost-per-1k-requests from each provider's published pricing at eval time.
 * This turns the operational fact "we substituted Gemini because the Groq key
 * was invalid" into a small formal comparison table for the thesis.
 *
 * Tasks (from the app's real AI features):
 *   1. query-parsing  — "science fiction under 500" → { category, maxPrice, keywords }
 *   2. ocr-extraction — structured book-metadata extraction from a cover text block
 *   3. review-summary — aggregate sentiment/pros/cons from review strings
 *
 * Usage:
 *   npm run eval:llm        # uses GROQ_API_KEY + GEMINI_API_KEY from .env
 *
 * Providers without a key are skipped and reported as such (no hard failure).
 */

interface ProviderResult {
  provider: string;
  model: string;
  configured: boolean;
  tasks: {
    task: string;
    ok: boolean;
    latencyMs: number;
    score: number;
    raw: string | null;
  }[];
}

interface EnvLike {
  groqApiKey: string;
  groqModel: string;
  geminiApiKey: string;
  geminiModel: string;
}

const readEnv = (): EnvLike => ({
  groqApiKey: process.env.GROQ_API_KEY ?? "",
  groqModel: process.env.GROQ_TEXT_MODEL || "llama-3.3-70b-versatile",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash",
});

const callGroq = async (env: EnvLike, prompt: string): Promise<string | null> => {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.groqApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.groqModel,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { choices?: { message: { content?: string } }[] };
  return body.choices?.[0]?.message?.content ?? null;
};

const callGemini = async (env: EnvLike, prompt: string): Promise<string | null> => {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent?key=${env.geminiApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { candidates?: { content: { parts: { text: string }[] } }[] };
  return body.candidates?.[0]?.content.parts.map((p) => p.text).join("") ?? null;
};

const parseJson = (text: string | null): Record<string, unknown> | null => {
  if (!text) return null;
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim()) as Record<string, unknown>;
  } catch {
    return null;
  }
};

// ── Fixed task set ─────────────────────────────────────────────────────────
const TASKS = [
  {
    name: "query-parsing",
    prompt: `Parse this book search into strict JSON: "science fiction books under 500 rupees with good ratings". Respond ONLY with JSON: {"category": string|null, "maxPrice": number|null, "minRating": number|null, "keywords": string[]}`,
    target: { category: "science fiction", maxPrice: 500, minRating: null, keywords: ["science fiction"] },
    score: (parsed: Record<string, unknown> | null): number => {
      if (!parsed) return 0;
      let hits = 0;
      if (String(parsed.category ?? "").toLowerCase().includes("science")) hits++;
      if (parsed.maxPrice === 500 || Number(parsed.maxPrice) === 500) hits++;
      if (Array.isArray(parsed.keywords) && parsed.keywords.length > 0) hits++;
      return hits / 3;
    },
  },
  {
    name: "ocr-extraction",
    prompt: `This is text OCR'd from a book cover: "THE FOUNDATION TRILOGY by Isaac Asimov, Published by Doubleday, ISBN 978-0-385-00000-0, Science Fiction". Extract strict JSON: {"title": string, "author": string, "isbn": string, "category": string}`,
    target: { title: "the foundation trilogy", author: "isaac asimov", isbn: "978-0-385-00000-0", category: "science fiction" },
    score: (parsed: Record<string, unknown> | null): number => {
      if (!parsed) return 0;
      const norm = (v: unknown): string => String(v ?? "").toLowerCase().trim();
      let hits = 0;
      if (norm(parsed.title).includes("foundation")) hits++;
      if (norm(parsed.author).includes("asimov")) hits++;
      if (norm(parsed.isbn).includes("978-0-385-00000-0") || norm(parsed.isbn).includes("978038500000")) hits++;
      if (norm(parsed.category).includes("science")) hits++;
      return hits / 4;
    },
  },
  {
    name: "review-summary",
    prompt:
      'Summarize sentiment from these book reviews: (1) "Loved it, gripping plot" (2) "Boring middle but strong ending" (3) "Great characters, pacing could improve". Respond ONLY with JSON: {"positivePercent": number, "commonPros": string[], "commonCons": string[]}',
    target: { positivePercent: 67, commonPros: ["plot", "characters"], commonCons: ["pacing"] },
    score: (parsed: Record<string, unknown> | null): number => {
      if (!parsed) return 0;
      let hits = 0;
      const pp = Number(parsed.positivePercent);
      if (Number.isFinite(pp) && pp >= 40 && pp <= 80) hits++;
      const pros = Array.isArray(parsed.commonPros) ? parsed.commonPros.join(" ").toLowerCase() : "";
      if (pros.includes("plot") || pros.includes("character")) hits++;
      const cons = Array.isArray(parsed.commonCons) ? parsed.commonCons.join(" ").toLowerCase() : "";
      if (cons.includes("pacing") || cons.includes("boring") || cons.includes("slow")) hits++;
      return hits / 3;
    },
  },
];

const runProvider = async (provider: string, env: EnvLike): Promise<ProviderResult> => {
  const configured = provider === "groq" ? !!env.groqApiKey : !!env.geminiApiKey;
  const model = provider === "groq" ? env.groqModel : env.geminiModel;
  const call = provider === "groq" ? callGroq : callGemini;

  const tasks = [];
  for (const task of TASKS) {
    if (!configured) {
      tasks.push({ task: task.name, ok: false, latencyMs: 0, score: 0, raw: null });
      continue;
    }
    const started = Date.now();
    let ok = false;
    let score = 0;
    let raw: string | null = null;
    try {
      raw = await call(env, task.prompt);
      const parsed = parseJson(raw);
      score = task.score(parsed);
      ok = parsed !== null;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[eval:llm] ${provider}/${task.name}: ${(err as Error).message}`);
    }
    tasks.push({ task: task.name, ok, latencyMs: Date.now() - started, score, raw });
  }
  return { provider, model, configured, tasks };
};

const run = async (): Promise<void> => {
  const env = readEnv();
  // eslint-disable-next-line no-console
  console.log(`[eval:llm] Groq configured=${!!env.groqApiKey} (${env.groqModel}) · Gemini configured=${!!env.geminiApiKey} (${env.geminiModel})`);

  const results: ProviderResult[] = [];
  for (const provider of ["groq", "gemini"]) {
    const r = await runProvider(provider, env);
    results.push(r);
    for (const t of r.tasks) {
      // eslint-disable-next-line no-console
      console.log(`[eval:llm] ${provider.padEnd(7)} ${t.task.padEnd(16)} ok=${t.ok} score=${t.score.toFixed(2)} latency=${t.latencyMs}ms`);
    }
  }

  const outDir = path.resolve(__dirname, "../../../experiments/llm");
  fs.mkdirSync(outDir, { recursive: true });
  const runId = new Date().toISOString().replace(/[:.]/g, "-");

  const summary = {
    generatedAt: new Date().toISOString(),
    // Published list pricing at eval time (edit when rates change):
    pricingPer1kRequests: {
      groq: { note: "llama-3.3-70b-versatile: input $0.59/M, output $0.79/M (published)", approxPer1k: 0.05 },
      gemini: { note: "gemini-2.5-flash: input $0.30/M, output $2.50/M (published)", approxPer1k: 0.05 },
    },
    providers: results,
  };
  fs.writeFileSync(path.join(outDir, `llm-comparison-${runId}.json`), JSON.stringify(summary, null, 2));

  const md = [
    "# Comparative LLM-Provider Study (§13.9)",
    "",
    `**Run:** \`${runId}\` · **Generated:** ${new Date().toISOString()}`,
    "",
    "## Tasks & scores (exact-match / rubric on structured output)",
    "",
    "| Provider | Task | OK | Score | Latency (ms) |",
    "|---|---|---|---|---|",
    ...results.flatMap((r) =>
      r.tasks.map((t) => `| ${r.provider} (${r.model}) | ${t.task} | ${t.ok} | ${t.score.toFixed(2)} | ${t.latencyMs} |`)
    ),
    "",
    "## Cost (per 1k requests, published pricing at eval time)",
    "",
    "| Provider | Note |",
    "|---|---|",
    ...Object.entries(summary.pricingPer1kRequests).map(([k, v]) => `| ${k} | ${(v as { note: string }).note} |`),
    "",
    "## Raw responses",
    "",
    ...results.flatMap((r) => r.tasks.filter((t) => t.raw).map((t) => `### ${r.provider} — ${t.task}\n\n\`\`\`\n${t.raw}\n\`\`\`\n`)),
    "",
  ].join("\n");
  fs.writeFileSync(path.join(outDir, `llm-comparison-${runId}.md`), md);
  // eslint-disable-next-line no-console
  console.log(`[eval:llm] wrote ${path.join(outDir, `llm-comparison-${runId}.md`)}`);
  process.exit(0);
};

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[eval:llm] Failed:", err);
  process.exit(1);
});