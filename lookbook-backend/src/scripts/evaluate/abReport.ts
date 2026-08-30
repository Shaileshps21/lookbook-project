import fs from "fs";
import path from "path";
import { Event } from "../../models/Event";
import { connectForScript } from "./dataset";
import { computeAbReport } from "../../utils/abStats";

/**
 * §13.3 — offline A/B report for the homepage recommendation experiment.
 * Mirrors GET /admin/analytics/ab-report but runs directly against MongoDB
 * (no HTTP layer) and writes a timestamped Markdown report under
 * `experiments/ab/` for the thesis. Prints CTR + click→conversion per arm
 * with a two-proportion z-test, plus a §13.8 recommendation-source breakdown.
 *
 * Usage:
 *   npm run eval:ab -- --days 30
 */

const parseDays = (argv: string[]): number => {
  const idx = argv.indexOf("--days");
  const v = idx >= 0 ? Number(argv[idx + 1]) : 30;
  return Math.min(Math.max(Number.isFinite(v) ? v : 30, 1), 90);
};

const run = async (): Promise<void> => {
  const days = parseDays(process.argv.slice(2));
  await connectForScript();

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);

  const events = await Event.find({
    createdAt: { $gte: start, $lte: end },
    event: { $in: ["recommendation_view", "recommendation_click", "wishlist_add", "add_to_cart", "begin_checkout", "checkout_success"] },
  })
    .select("event sessionId data")
    .lean();

  const report = computeAbReport(
    events.map((e) => ({ event: e.event, sessionId: e.sessionId, data: e.data as Record<string, unknown> | undefined }))
  );

  const fmt = (x: number) => (x * 100).toFixed(2) + "%";
  const armRow = (arm: (typeof report.arms)[number]) =>
    `${arm.arm.padEnd(11)} imp=${String(arm.impressions).padEnd(6)} clicks=${String(arm.clicks).padEnd(5)} conv=${String(arm.conversions).padEnd(4)} CTR=${fmt(arm.ctr)} imp→conv=${fmt(arm.impressionToConversionRate)} click→conv=${fmt(arm.clickToConversionRate)}`;

  // eslint-disable-next-line no-console
  console.log("\n── §13.3 A/B report ─────────────────────────────────────");
  report.arms.forEach((a) => console.log(armRow(a)));
  // eslint-disable-next-line no-console
  console.log(`\nCTR z-test: z=${report.tests.ctr.z.toFixed(3)} p=${report.tests.ctr.pValue.toFixed(4)} ${report.tests.ctr.significant ? "(significant)" : "(not significant)"}`);
  // eslint-disable-next-line no-console
  console.log(`click→conv z-test: z=${report.tests.clickToConversion.z.toFixed(3)} p=${report.tests.clickToConversion.pValue.toFixed(4)} ${report.tests.clickToConversion.significant ? "(significant)" : "(not significant)"}`);
  // eslint-disable-next-line no-console
  console.log("\n── §13.8 recommendation-source breakdown ────────────────");
  report.sources.forEach((s) =>
    // eslint-disable-next-line no-console
    console.log(`${s.source.padEnd(48)} clicks=${String(s.clicks).padEnd(4)} conv=${String(s.conversions).padEnd(3)} convRate=${fmt(s.conversionRate)}`)
  );

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.resolve(__dirname, "../../../experiments/ab");
  fs.mkdirSync(outDir, { recursive: true });
  const md = [
    "# Homepage Recommendation A/B Report",
    "",
    `**Run:** \`${runId}\` · **Window:** last ${days} days · **Generated:** ${new Date().toISOString()}`,
    "",
    "## Arms",
    "",
    "| Arm | Impressions | Clicks | Conversions | CTR | Imp→Conv | Click→Conv |",
    "|---|---|---|---|---|---|---|",
    ...report.arms.map((a) => `| ${a.arm} | ${a.impressions} | ${a.clicks} | ${a.conversions} | ${fmt(a.ctr)} | ${fmt(a.impressionToConversionRate)} | ${fmt(a.clickToConversionRate)} |`),
    "",
    "## Significance tests (two-proportion z-test)",
    "",
    "| Metric | z | p-value | Significant (p<0.05)? |",
    "|---|---|---|---|",
    `| CTR | ${report.tests.ctr.z.toFixed(3)} | ${report.tests.ctr.pValue.toFixed(4)} | ${report.tests.ctr.significant} |`,
    `| Click→conversion | ${report.tests.clickToConversion.z.toFixed(3)} | ${report.tests.clickToConversion.pValue.toFixed(4)} | ${report.tests.clickToConversion.significant} |`,
    "",
    "## Conversion by recommendation source (§13.8)",
    "",
    "| Source | Clicks | Conversions | Conversion rate |",
    "|---|---|---|---|",
    ...report.sources.map((s) => `| ${s.source} | ${s.clicks} | ${s.conversions} | ${fmt(s.conversionRate)} |`),
    "",
    "> Methodology: a conversion is a clicked book that the same analytics session later wishlist-added / added to cart / began checkout on. This is a lightweight methodology demonstration, not a large-scale claim.",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(outDir, `ab-report-${runId}.md`), md);
  // eslint-disable-next-line no-console
  console.log(`\nWrote ${path.join(outDir, `ab-report-${runId}.md`)}`);
  process.exit(0);
};

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[eval:ab] Failed:", err);
  process.exit(1);
});