// One-time (repeatable) catalog growth run — pulls real book data from the
// free, keyless Open Library API across the app's existing categories.
// Same field-mapping/pricing logic as bookImportController.ts, but skips
// the per-book description fetch (too slow at this volume) and AI-summary
// generation (would blow through Gemini's free-tier rate limit importing
// this many books at once) — embeddings only, since those matter most for
// search/recommendations. Run with: npx ts-node src/scripts/importBooksFromApi.ts
import { connectDB, disconnectDB } from "../config/db";
import { Book } from "../models/Book";
import { Category } from "../models/Category";
import { searchExternalBooks } from "../utils/openLibraryApi";
import { generateEmbedding, bookEmbeddingText } from "../utils/embeddings";

const log = (...args: unknown[]) => {
  // eslint-disable-next-line no-console
  console.log(...args);
};

const CATEGORY_QUERIES: Record<string, string> = {
  Fiction: "subject:fiction",
  Business: "subject:business",
  History: "subject:history",
  "Self Help": "subject:self-help",
  Romance: "subject:romance",
  Science: "subject:science",
};

const PER_CATEGORY_TARGET = 25;

const priceFromPages = (pages?: number): { rentPrice: number; buyPrice: number } => {
  const p = pages ?? 250;
  const buyPrice = Math.min(699, Math.max(149, Math.round((149 + p * 0.6) / 10) * 10));
  const rentPrice = Math.round(buyPrice * 0.18);
  return { rentPrice, buyPrice };
};

const run = async () => {
  await connectDB();

  let totalImported = 0;

  for (const [category, query] of Object.entries(CATEGORY_QUERIES)) {
    log(`\n[import] Fetching "${category}" (${query})...`);

    let results;
    try {
      results = await searchExternalBooks(query, PER_CATEGORY_TARGET * 2);
    } catch (err) {
      log(`[import] Search failed for ${category}:`, err instanceof Error ? err.message : err);
      continue;
    }

    let importedForCategory = 0;
    for (const item of results) {
      if (importedForCategory >= PER_CATEGORY_TARGET) break;

      const exists = item.isbn
        ? await Book.findOne({ isbn: item.isbn })
        : await Book.findOne({ title: item.title, author: item.author });
      if (exists) continue;

      const { rentPrice, buyPrice } = priceFromPages(item.pages);
      const subjectsLine = item.subjects.slice(0, 3).join(", ");

      try {
        const book = await Book.create({
          title: item.title,
          author: item.author,
          image: item.image,
          category,
          rentPrice,
          buyPrice,
          description: subjectsLine
            ? `${item.title} by ${item.author}. Touches on ${subjectsLine}.`
            : `${item.title} by ${item.author}.`,
          publisher: item.publisher,
          published: item.published,
          pages: item.pages,
          language: "English",
          isbn: item.isbn,
          stock: 5 + Math.floor(Math.random() * 15),
          tags: item.subjects.map((s) => s.toLowerCase()).slice(0, 6),
        });

        generateEmbedding(bookEmbeddingText(book))
          .then((embedding) => embedding && Book.updateOne({ _id: book.id }, { embedding }))
          .catch(() => log(`[import] Embedding failed for "${book.title}" (non-fatal).`));

        importedForCategory++;
        totalImported++;
        log(`[import] + "${item.title}" by ${item.author}`);
      } catch (err) {
        log(`[import] Skipped "${item.title}":`, err instanceof Error ? err.message : err);
      }
    }

    if (importedForCategory > 0) {
      await Category.findOneAndUpdate(
        { name: category },
        { $inc: { count: importedForCategory } },
        { upsert: true, setDefaultsOnInsert: true }
      );
    }
    log(`[import] ${category}: imported ${importedForCategory} book(s).`);
  }

  log(`\n[import] Done. ${totalImported} book(s) imported in total.`);
  log("[import] Embeddings are still filling in the background for a few seconds — that's expected.");
  await new Promise((resolve) => setTimeout(resolve, 5000));
  await disconnectDB();
  process.exit(0);
};

run().catch(async (err) => {
  log("[import] Fatal error:", err);
  await disconnectDB();
  process.exit(1);
});
