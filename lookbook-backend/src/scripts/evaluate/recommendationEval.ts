import fs from "fs";
import path from "path";
import { buildDataset, loadDataset, connectForScript, type EvalBook, type Interaction } from "./dataset";
import { allStrategies, similarityFor } from "./baselines";
import { evaluateStrategy, type StrategyMetrics } from "./metrics";
import { barChartSvg } from "./svgChart";

/**
 * §13.2 — Formal offline evaluation of the recommendation engine.
 *
 * Runs the §3.2 hybrid and its baselines (random, popularity, pure content-
 * based, pure collaborative) + the ablation study against a chronological
 * train/test split of real UserActivity + paid-order history, and writes a
 * fully reproducible run (config + results + CSV + Markdown report + SVG
 * plots) under `experiments/<run-id>/` per §13.7.
 *
 * Usage:
 *   npm run eval:recommendations -- --split-date 2026-01-01 --k 10 --min-train 3
 *   npm run eval:recommendations -- --snapshot experiments/dataset/snapshot.json
 *   MONGO_URI=... npm run eval:recommendations
 */

interface CliArgs {
  splitDate?: string;
  k: number;
  minTrain: number;
  limitUsers?: number;
  seed: number;
  snapshot?: string;
  outDir: string;
}

const parseArgs = (argv: string[]): CliArgs => {
  const args: CliArgs = { k: 10, minTrain: 3, seed: 42, outDir: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === "--split-date" && next) args.splitDate = next;
    if (a === "--k" && next) args.k = Number(next);
    if (a === "--min-train" && next) args.minTrain = Number(next);
    if (a === "--limit-users" && next) args.limitUsers = Number(next);
    if (a === "--seed" && next) args.seed = Number(next);
    if (a === "--snapshot" && next) args.snapshot = next;
    if (a === "--out" && next) args.outDir = next;
  }
  return args;
};

const run = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));
  const splitDateMs = args.splitDate ? new Date(args.splitDate).getTime() : null;

  // eslint-disable-next-line no-console
  console.log(`[eval] Connecting ${args.snapshot ? `snapshot ${args.snapshot}` : "to MongoDB (MONGO_URI or default local)"}…`);

  let ds;
  if (args.snapshot) {
    const raw = JSON.parse(fs.readFileSync(args.snapshot, "utf-8")) as {
      splitDateMs: number | null;
      books: EvalBook[];
      interactions: Interaction[];
    };
    ds = buildDataset(raw.books, raw.interactions, raw.splitDateMs ?? splitDateMs);
  } else {
    await connectForScript();
    ds = await loadDataset({ splitDateMs });
  }

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = args.outDir || path.resolve(__dirname, "../../../experiments", runId);
  fs.mkdirSync(outDir, { recursive: true });

  // Chronological split (train < splitDate ≤ test).
  const users = ds.users
    .filter((u) => u.trainBooks.length >= args.minTrain)
    .sort((a, b) => a.trainBooks.length - b.trainBooks.length);
  const evaluatedUsers = args.limitUsers ? users.slice(-args.limitUsers) : users;

  // eslint-disable-next-line no-console
  console.log(`[eval] Catalog: ${ds.catalogIds.length} books · users: ${evaluatedUsers.length} (of ${users.length} with ≥${args.minTrain} train interactions)`);

  const relevant = evaluatedUsers.map((u) => new Set(u.testBooks));
  const sim = similarityFor(ds);

  const strategies = allStrategies(ds);
  const results: StrategyMetrics[] = [];
  const recsByUser: Record<string, string[][]> = {};

  for (const { label, fn } of strategies) {
    const allRecs = evaluatedUsers.map((u) => fn(u, args.k));
    recsByUser[label] = allRecs;
    const metrics = evaluateStrategy(label, allRecs, relevant, ds.catalogIds.length, args.k, sim);
    results.push(metrics);
    // eslint-disable-next-line no-console
    console.log(`[eval] ${label.padEnd(22)} P@${args.k}=${metrics.precisionAtK.toFixed(4)} R@${args.k}=${metrics.recallAtK.toFixed(4)} NDCG@${args.k}=${metrics.ndcgAtK.toFixed(4)} cov=${metrics.coverage.toFixed(4)} div=${metrics.diversity.toFixed(4)}`);
  }

  // ── Write artifacts (config + results, §13.7 reproducibility) ──────────
  const config = {
    runId,
    createdAt: new Date().toISOString(),
    splitDate: args.splitDate ?? (splitDateMs ? new Date(splitDateMs).toISOString() : "median"),
    k: args.k,
    minTrain: args.minTrain,
    seed: args.seed,
    limitUsers: args.limitUsers ?? null,
    catalogSize: ds.catalogIds.length,
    evaluatedUsers: evaluatedUsers.length,
    strategies: strategies.map((s) => s.label),
    dataSource: args.snapshot ?? "mongodb",
  };
  fs.writeFileSync(path.join(outDir, "config.json"), JSON.stringify(config, null, 2));

  const csvRows = [
    "strategy,metric,value",
    ...results.flatMap((m) => [
      `${m.strategy},precision_at_k,${m.precisionAtK}`,
      `${m.strategy},recall_at_k,${m.recallAtK}`,
      `${m.strategy},ndcg_at_k,${m.ndcgAtK}`,
      `${m.strategy},coverage,${m.coverage}`,
      `${m.strategy},diversity,${m.diversity}`,
    ]),
  ];
  fs.writeFileSync(path.join(outDir, "results.csv"), csvRows.join("\n"));
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));

  // ── Markdown report ────────────────────────────────────────────────────
  const md = [
    "# Recommendation Engine — Offline Evaluation",
    "",
    `**Run:** \`${runId}\` · **Generated:** ${new Date().toISOString()}`,
    "",
    "## Configuration (§13.7 — every run is reproducible from this file)",
    "",
    "```json",
    JSON.stringify(config, null, 2),
    "```",
    "",
    "## Results table",
    "",
    "| Strategy | Precision@K | Recall@K | NDCG@K | Coverage | Diversity |",
    "|---|---|---|---|---|---|",
    ...results.map(
      (m) =>
        `| ${m.strategy} | ${m.precisionAtK.toFixed(4)} | ${m.recallAtK.toFixed(4)} | ${m.ndcgAtK.toFixed(4)} | ${m.coverage.toFixed(4)} | ${m.diversity.toFixed(4)} |`
    ),
    "",
    "## Plots",
    "",
    "### Precision@K by strategy",
    "",
    barChartSvg({
      title: `Precision@${args.k}`,
      yLabel: "Precision@K",
      labels: results.map((r) => r.strategy),
      values: results.map((r) => r.precisionAtK),
    }),
    "",
    "### NDCG@K by strategy",
    "",
    barChartSvg({
      title: `NDCG@${args.k}`,
      yLabel: "NDCG@K",
      labels: results.map((r) => r.strategy),
      values: results.map((r) => r.ndcgAtK),
    }),
    "",
    "### Coverage vs. Diversity",
    "",
    barChartSvg({
      title: "Coverage and Diversity",
      yLabel: "Ratio",
      labels: results.map((r) => r.strategy),
      values: results.map((r) => r.coverage),
      secondary: [{ label: "Diversity", values: results.map((r) => r.diversity) }],
    }),
    "",
    "## Notes",
    "",
    "- Split is **chronological** (train on activity before the split date, test on activity after) to avoid future leakage, per §13.2.",
    "- The **hybrid** mirrors the production §3.2 pipeline (content/vector + collaborative + popularity).",
    "- The last three rows are **ablations** of the hybrid: remove one component at a time to attribute contribution.",
    "- Random uses a seeded PRNG (`seed` above) so it is reproducible.",
    "- Raw data used: `config.dataSource`. Rebuild the same snapshot via `npm run export:dataset`.",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(outDir, "report.md"), md);

  // eslint-disable-next-line no-console
  console.log(`[eval] Wrote run artifacts to ${outDir}`);
  process.exit(0);
};

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[eval] Failed:", err);
  process.exit(1);
});