import fs from "fs";
import path from "path";
import { Book } from "../../models/Book";
import { Order } from "../../models/Order";
import { UserActivity } from "../../models/UserActivity";
import { connectForScript } from "../evaluate/dataset";

/**
 * §13.4.2 — MongoDB query-plan analysis.
 *
 * Runs `.explain("executionStats")` on the top heavy query shapes used by the
 * app (book search/filter/sort, homepage sections, order/user-activity
 * lookups), and reports execution time, documents examined vs returned, and
 * whether an index is actually being used — or whether a COLLSCAN is hiding
 * there. Concrete before/after numbers like this are the evidence the thesis
 * evaluation chapter (§13.4) wants, not a qualitative claim.
 *
 * Usage:
 *   npm run bench:query-plans
 *   MONGO_URI=... npm run bench:query-plans
 */

interface QueryReport {
  label: string;
  query: string;
  executionTimeMs: number;
  docsExamined: number;
  keysExamined: number;
  nReturned: number;
  scanStage: string;
  indexUsed: boolean;
  suggestedFix?: string;
}

const summarize = (explain: Record<string, any>): Omit<QueryReport, "label" | "query" | "suggestedFix"> => {
  const execution = explain.executionStats ?? {};
  let scanStage = "unknown";
  let indexUsed = false;

  const walk = (node: any): void => {
    if (!node || typeof node !== "object") return;
    if (node.stage === "IXSCAN" || node.stage === "SORT_MERGE") {
      scanStage = node.stage;
      indexUsed = true;
    } else if (node.stage === "COLLSCAN") {
      scanStage = "COLLSCAN";
    }
    if (node.inputStage) walk(node.inputStage);
    if (Array.isArray(node.inputStages)) node.inputStages.forEach(walk);
    if (node.executionStages) walk(node.executionStages);
  };

  walk(execution.executionStages);
  // Fall back to the winning plan when executionStages is shaped differently.
  if (scanStage === "unknown") {
    walk(explain.queryPlanner?.winningPlan);
  }

  return {
    executionTimeMs: execution.executionTimeMillis ?? 0,
    docsExamined: execution.totalDocsExamined ?? 0,
    keysExamined: execution.totalKeysExamined ?? 0,
    nReturned: execution.nReturned ?? 0,
    scanStage,
    indexUsed,
  };
};

const run = async (): Promise<void> => {
  await connectForScript();

  const queries: { label: string; run: () => Promise<Record<string, any>>; suggestedFix?: string }[] = [
    {
      label: "Book list search (title/author/tags regex)",
      suggestedFix: "Text index exists ({title,author,tags}); regex `/the/i` can't use it — consider $text for prefix/word queries.",
      run: async () =>
        await Book.find({ $or: [{ title: /the/i }, { author: /the/i }, { tags: /the/i }] }).sort("-reviewsCount").skip(0).limit(12).explain("executionStats"),
    },
    {
      label: "Book count for same search",
      run: async () =>
        (await Book.find({ $or: [{ title: /the/i }, { author: /the/i }, { tags: /the/i }] }).countDocuments().explain("executionStats")) as unknown as Record<string, any>,
    },
    {
      label: "Category + price filter, rating sort",
      suggestedFix: "Compound index { category:1, rentPrice:1, rating:-1 } would cover filter+sort.",
      run: async () =>
        await Book.find({ category: "Fiction", rentPrice: { $lte: 500 } }).sort("-rating").skip(0).limit(12).explain("executionStats"),
    },
    {
      label: "Homepage: popular (rating+reviews sort)",
      suggestedFix: "Index { rating:-1, reviewsCount:-1 }.",
      run: async () => await Book.find().sort("-rating -reviewsCount").limit(8).explain("executionStats"),
    },
    {
      label: "Homepage: new releases (createdAt sort)",
      run: async () => await Book.find().sort("-createdAt").limit(8).explain("executionStats"),
    },
    {
      label: "Homepage: popular in genre",
      suggestedFix: "Index { category:1, rating:-1, reviewsCount:-1 }.",
      run: async () => await Book.find({ category: { $in: ["Fiction", "Romance"] } }).sort("-rating -reviewsCount").limit(8).explain("executionStats"),
    },
    {
      label: "UserActivity: recent activity for homepage",
      run: async () =>
        await UserActivity.find({ user: "000000000000000000000000" }).sort("-weight -createdAt").limit(50).explain("executionStats"),
    },
    {
      label: "Order: user's order history",
      run: async () => await Order.find({ user: "000000000000000000000000" }).sort("-createdAt").explain("executionStats"),
    },
    {
      label: "Public API: filtered book list + count",
      run: async () =>
        await Book.find({ category: "Fiction" }).sort("-rating").skip(0).limit(24).explain("executionStats"),
    },
    {
      label: "Book by ISBN (catalog-first lookup)",
      run: async () =>
        await Book.find({ isbn: { $regex: /^9[- ]?7[- ]?8/ } }).select("title author isbn").explain("executionStats"),
    },
  ];

  const reports: QueryReport[] = [];
  for (const q of queries) {
    try {
      const explain = await q.run();
      const s = summarize(explain);
      reports.push({ label: q.label, query: "", suggestedFix: q.suggestedFix, ...s });
      // eslint-disable-next-line no-console
      console.log(
        `[query-plans] ${q.label.padEnd(48)} ${String(s.executionTimeMs).padStart(5)}ms  examined=${String(s.docsExamined).padStart(6)} returned=${String(s.nReturned).padStart(4)}  ${s.scanStage}${s.indexUsed ? " (index)" : "  ← CHECK"}`
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[query-plans] ${q.label}: skipped (${(err as Error).message})`);
    }
  }

  const outDir = path.resolve(__dirname, "../../../experiments/benchmark");
  fs.mkdirSync(outDir, { recursive: true });
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(outDir, `query-plans-${runId}.json`);
  fs.writeFileSync(file, JSON.stringify({ generatedAt: new Date().toISOString(), catalogSize: await Book.countDocuments(), reports }, null, 2));

  const md = [
    "# MongoDB Query-Plan Analysis",
    "",
    `**Generated:** ${new Date().toISOString()} · catalog size ${await Book.countDocuments()}`,
    "",
    "| Query | Time (ms) | Docs examined | Docs returned | Scan stage |",
    "|---|---|---|---|---|",
    ...reports.map((r) => `| ${r.label} | ${r.executionTimeMs} | ${r.docsExamined} | ${r.nReturned} | ${r.scanStage}${r.indexUsed ? " (index)" : ""} |`),
    "",
    "## Findings & suggested indexes",
    "",
    ...reports.filter((r) => r.suggestedFix).map((r) => `- **${r.label}** — ${r.suggestedFix}`),
    "",
    `> Full executionStats are in the sibling JSON file (\`query-plans-${runId}.json\`).`,
    "",
  ].join("\n");
  fs.writeFileSync(path.join(outDir, `query-plans-${runId}.md`), md);
  // eslint-disable-next-line no-console
  console.log(`[query-plans] wrote ${file}`);
  process.exit(0);
};

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[query-plans] Failed:", err);
  process.exit(1);
});