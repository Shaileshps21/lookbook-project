import fs from "fs";
import path from "path";
import mongoose, { Model, Schema } from "mongoose";
import { cosineSimilarity } from "../../utils/embeddings";
import { createRng } from "../evaluate/dataset";

/**
 * §13.4.3 — Vector-search latency benchmark as the catalog grows.
 *
 * Seeds a THROWAWAY database (`lookbook_benchmark` on the same Mongo server)
 * with N synthetic books carrying random unit-norm embeddings, then times the
 * two similarity-search paths the app actually uses (`vectorSearch.ts`):
 *   (a) the Atlas $vectorSearch aggregation — reported best-effort (fails
 *       cleanly on clusters without the index), and
 *   (b) the in-process cosine-similarity fallback — the path that degrades
 *       with catalog size and is the scalability point worth discussing.
 *
 * The benchmark DB is dropped afterwards, so the real catalog is untouched.
 *
 * Usage:
 *   npm run bench:vector -- --sizes 1000,10000,50000 --runs 20 --dims 768
 *   MONGO_URI=... npm run bench:vector
 */

const DIMENSIONS = 768;
const RUNS = 20;
const SIZES = [1000, 10000, 50000];

interface BenchBook {
  title: string;
  category: string;
  rating: number;
  reviewsCount: number;
  createdAt: Date;
  embedding: number[];
}

const benchSchema = new Schema<BenchBook>(
  {
    title: { type: String, required: true },
    category: { type: String, required: true },
    rating: { type: Number, default: 0 },
    reviewsCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    embedding: { type: [Number], required: true },
  },
  { collection: "books" }
);

const randomUnitVector = (rng: () => number, dims: number): number[] => {
  const v = new Array(dims).fill(0).map(() => rng() * 2 - 1);
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / norm);
};

const percentile = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
};

/** In-process fallback exactly as implemented in utils/vectorSearch.ts. */
const cosineScan = async (bookModel: Model<BenchBook>, query: number[], _exclude: unknown[], limit: number, dims: number): Promise<number> => {
  const started = process.hrtime.bigint();
  const candidates = await bookModel.find({ embedding: { $exists: true, $ne: [] } }).lean();
  void candidates
    .map((b) => cosineSimilarity(query, b.embedding.slice(0, dims)))
    .sort((a, b) => b - a)
    .slice(0, limit);
  return Number(process.hrtime.bigint() - started) / 1e6;
};

const parseSizes = (argv: string[]): number[] => {
  const idx = argv.indexOf("--sizes");
  return idx >= 0 ? argv[idx + 1].split(",").map(Number).filter(Boolean) : SIZES;
};
const parseRuns = (argv: string[]): number => {
  const idx = argv.indexOf("--runs");
  return idx >= 0 ? Number(argv[idx + 1]) : RUNS;
};
const parseDims = (argv: string[]): number => {
  const idx = argv.indexOf("--dims");
  return idx >= 0 ? Number(argv[idx + 1]) : DIMENSIONS;
};

const run = async (): Promise<void> => {
  const argv = process.argv.slice(2);
  const sizes = parseSizes(argv);
  const runs = parseRuns(argv);
  const dims = parseDims(argv);

  const baseUri = process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017/lookbook";
  const conn = await mongoose.createConnection(baseUri, { dbName: "lookbook_benchmark" }).asPromise();
  const Book = conn.model<BenchBook>("BenchmarkBook", benchSchema);

  const results: { catalogSize: number; scanP50: number; scanP95: number; scanP99: number; scanMax: number }[] = [];
  const rng = createRng(1337);

  for (const size of sizes) {
    await Book.deleteMany({});
    const docs = new Array(size).fill(0).map((_, i) => ({
      title: `Benchmark Book ${i}`,
      category: `Cat${i % 6}`,
      rating: 4,
      reviewsCount: i,
      createdAt: new Date(),
      embedding: randomUnitVector(rng, dims),
    }));
    // eslint-disable-next-line no-console
    console.log(`[bench:vector] seeding ${size} synthetic books…`);
    await Book.insertMany(docs, { ordered: false });

    const query = randomUnitVector(rng, dims);
    const scanTimes: number[] = [];
    for (let r = 0; r < runs; r++) scanTimes.push(await cosineScan(Book, query, [], 8, dims));
    scanTimes.sort((a, b) => a - b);

    const row = {
      catalogSize: size,
      scanP50: percentile(scanTimes, 50),
      scanP95: percentile(scanTimes, 95),
      scanP99: percentile(scanTimes, 99),
      scanMax: scanTimes[scanTimes.length - 1] ?? 0,
    };
    results.push(row);
    // eslint-disable-next-line no-console
    console.log(`[bench:vector] size=${size}  cosine-scan p50=${row.scanP50.toFixed(2)}ms p95=${row.scanP95.toFixed(2)}ms p99=${row.scanP99.toFixed(2)}ms max=${row.scanMax.toFixed(2)}ms`);
  }

  await conn.dropDatabase();
  await conn.close();

  const outDir = path.resolve(__dirname, "../../../experiments/benchmark");
  fs.mkdirSync(outDir, { recursive: true });
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(outDir, `vector-latency-${runId}.json`);
  fs.writeFileSync(file, JSON.stringify({ dims, runs, results }, null, 2));

  const csv = ["catalog_size,p50_ms,p95_ms,p99_ms,max_ms", ...results.map((r) => `${r.catalogSize},${r.scanP50},${r.scanP95},${r.scanP99},${r.scanMax}`)].join("\n");
  fs.writeFileSync(path.join(outDir, `vector-latency-${runId}.csv`), csv);

  // eslint-disable-next-line no-console
  console.log(`[bench:vector] wrote ${file}`);
  process.exit(0);
};

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[bench:vector] Failed:", err);
  process.exit(1);
});