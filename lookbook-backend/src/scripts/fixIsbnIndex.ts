import mongoose from "mongoose";
import { env } from "../config/env";

/**
 * One-off migration: replace the legacy plain-unique `isbn_1` index on `books`
 * with a partial index scoped to real string ISBNs.
 *
 * Why: the old index was `{unique: true}` with no sparse/partial filter, so
 * MongoDB indexed every ISBN-less book under the key `null` and rejected the
 * second one as a duplicate. In practice that made **any seller listing
 * without an ISBN impossible to approve** — approval creates a Book, and the
 * insert failed with E11000 (surfaced in the admin UI as a 409).
 *
 * Also clears explicitly-null `isbn` values, which are semantically identical
 * to "no ISBN" but would still be indexed by a merely-sparse index.
 *
 * Index-only + a null→unset cleanup: no book documents are removed, and the
 * new index is created before the script exits.
 *
 * Usage: npx ts-node src/scripts/fixIsbnIndex.ts
 */
const run = async (): Promise<void> => {
  await mongoose.connect(env.mongoUri);
  const books = mongoose.connection.db!.collection("books");

  const before = await books.indexes();
  const legacy = before.find((i) => i.name === "isbn_1");
  // eslint-disable-next-line no-console
  console.log("[fix-isbn-index] existing:", JSON.stringify(legacy ?? "none"));

  if (legacy && !legacy.partialFilterExpression) {
    await books.dropIndex("isbn_1");
    // eslint-disable-next-line no-console
    console.log("[fix-isbn-index] dropped legacy isbn_1");
  }

  const cleared = await books.updateMany({ isbn: null }, { $unset: { isbn: "" } });
  // eslint-disable-next-line no-console
  console.log(`[fix-isbn-index] cleared ${cleared.modifiedCount} explicit null isbn value(s)`);

  await books.createIndex(
    { isbn: 1 },
    { unique: true, partialFilterExpression: { isbn: { $type: "string" } }, name: "isbn_1" }
  );

  const after = await books.indexes();
  // eslint-disable-next-line no-console
  console.log("[fix-isbn-index] now:", JSON.stringify(after.find((i) => i.name === "isbn_1")));

  await mongoose.disconnect();
};

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[fix-isbn-index] failed:", err);
  process.exit(1);
});
