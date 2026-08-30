import { connectDB, disconnectDB } from "../config/db";
import { Book } from "../models/Book";
import { generateEmbedding, bookEmbeddingText } from "../utils/embeddings";

const log = (...args: unknown[]) => {
  // eslint-disable-next-line no-console
  console.log(...args);
};

const run = async () => {
  await connectDB();

  const books = await Book.find({
    $or: [{ embedding: { $exists: false } }, { embedding: { $size: 0 } }],
  }).select("+embedding");

  log(`[embed] ${books.length} book(s) need an embedding.`);

  for (const book of books) {
    const embedding = await generateEmbedding(bookEmbeddingText(book));
    if (!embedding) {
      log(`[embed] Skipped "${book.title}" — Gemini request failed.`);
      continue;
    }
    book.embedding = embedding;
    await book.save();
    log(`[embed] Embedded "${book.title}".`);
  }

  log("[embed] Done.");
  await disconnectDB();
  process.exit(0);
};

run().catch((err) => {
  log("[embed] Failed:", err);
  process.exit(1);
});
