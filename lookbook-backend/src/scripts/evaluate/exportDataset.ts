import fs from "fs";
import path from "path";
import { loadDataset, connectForScript, type EvalBook, type Interaction } from "./dataset";

/**
 * §13.7 — Reproducibility dataset snapshot export.
 *
 * Exports an ANONYMIZED snapshot of the data used by the offline evaluation:
 * books + interactions (UserActivity + paid order items) with user ids
 * replaced by opaque `u1, u2, …` labels (no names, emails, IPs, or anything
 * else identifying), written under `experiments/dataset/`. The snapshot can
 * be re-run through `npm run eval:recommendations -- --snapshot <file>` so a
 * thesis committee could in principle reproduce every number.
 *
 * Usage:
 *   npm run export:dataset
 */

const run = async (): Promise<void> => {
  await connectForScript();
  const ds = await loadDataset({ splitDateMs: null });

  // Anonymization: stable per-user opaque labels, nothing else carries PII.
  const userIndex = new Map<string, string>();
  const anon = (u: string): string => {
    if (!userIndex.has(u)) userIndex.set(u, `u${userIndex.size + 1}`);
    return userIndex.get(u)!;
  };

  const interactions: Interaction[] = ds.interactions.map((i) => ({ ...i, user: anon(i.user) }));
  const books: EvalBook[] = ds.books.map((b) => ({ ...b, embedding: b.embedding ?? undefined }));

  const dir = path.resolve(__dirname, "../../../experiments/dataset");
  fs.mkdirSync(dir, { recursive: true });

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(dir, `snapshot-${runId}.json`);
  fs.writeFileSync(
    jsonPath,
    JSON.stringify({ createdAt: new Date().toISOString(), splitDateMs: null, books, interactions }, null, 2)
  );

  // Human-readable CSVs alongside the canonical JSON snapshot.
  fs.writeFileSync(
    path.join(dir, `books-${runId}.csv`),
    ["id,title,author,category,tags,has_embedding,rating,reviewsCount", ...books.map((b) => `"${b.id}","${b.title.replace(/"/g, '""')}","${b.author.replace(/"/g, '""')}","${b.category}",${(b.tags ?? []).length},${b.embedding ? 1 : 0},${b.rating},${b.reviewsCount}`)].join("\n")
  );
  fs.writeFileSync(
    path.join(dir, `interactions-${runId}.csv`),
    ["user,book,weight,timestamp", ...interactions.map((i) => `${i.user},${i.book},${i.weight},${new Date(i.ts).toISOString()}`)].join("\n")
  );

  // eslint-disable-next-line no-console
  console.log(`[export:dataset] ${books.length} books, ${interactions.length} interactions, ${new Set(interactions.map((i) => i.user)).size} users → ${jsonPath}`);
  process.exit(0);
};

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[export:dataset] Failed:", err);
  process.exit(1);
});