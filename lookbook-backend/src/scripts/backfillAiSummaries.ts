import { connectDB, disconnectDB } from "../config/db";
import { Book, type IAiSummary } from "../models/Book";
import { generateJson } from "../utils/ai";
import { bookEmbeddingText } from "../utils/embeddings";

const log = (...args: unknown[]) => {
  // eslint-disable-next-line no-console
  console.log(...args);
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const run = async () => {
  await connectDB();

  const books = await Book.find({ aiSummary: { $exists: false } });
  log(`[ai] ${books.length} book(s) need a summary.`);

  for (const book of books) {
    // Gemini's free tier caps at 5 requests/minute for this model — pace
    // requests well under that rather than bursting and hitting 429s.
    await sleep(13_000);

    const summary = await generateJson<IAiSummary>(
      `Given this book's publisher description, produce a reader-facing summary.\n${bookEmbeddingText(book)}`,
      `{"keyTakeaways": string[] (3-5 items), "difficulty": "Beginner"|"Intermediate"|"Advanced", "readingTimeHours": number, "targetAudience": string (one sentence), "topicsCovered": string[] (3-6 items)}`
    );
    if (!summary) {
      log(`[ai] Skipped "${book.title}" — generation failed.`);
      continue;
    }
    book.aiSummary = summary;
    await book.save();
    log(`[ai] Summarized "${book.title}".`);
  }

  log("[ai] Done.");
  await disconnectDB();
  process.exit(0);
};

run().catch((err) => {
  log("[ai] Failed:", err);
  process.exit(1);
});
