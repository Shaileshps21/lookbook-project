import { connectDB, disconnectDB } from "./config/db";
import { Book } from "./models/Book";
import { Category } from "./models/Category";
import { Plan } from "./models/Plan";
import { User } from "./models/User";
import { seedBooks } from "./data/seedBooks";
import { seedCategories } from "./data/seedCategories";
import { seedPlans } from "./data/seedPlans";

const log = (...args: unknown[]) => {
  // eslint-disable-next-line no-console
  console.log(...args);
};

const destroy = async () => {
  await Promise.all([Book.deleteMany(), Category.deleteMany(), Plan.deleteMany()]);
  log("[seed] All Book, Category, and Plan data destroyed.");
};

const importData = async () => {
  await Promise.all([Book.deleteMany(), Category.deleteMany(), Plan.deleteMany()]);

  await Category.insertMany(seedCategories);
  await Plan.insertMany(seedPlans);
  await Book.insertMany(
    seedBooks.map((book) => ({
      ...book,
      isbn: book.isbn ? book.isbn.replace(/[^0-9Xx]/g, "").toUpperCase() : undefined,
    })),
  );

  const adminEmail = "admin@lookbook.dev";
  const existingAdmin = await User.findOne({ email: adminEmail });
  if (!existingAdmin) {
    await User.create({
      name: "LookBook Admin",
      email: adminEmail,
      password: "Admin@12345",
      role: "admin",
      // emailVerified so the documented "log in as admin -> checkout" demo flow works.
      emailVerified: true,
    });
    log(`[seed] Demo admin created -> email: ${adminEmail} / password: Admin@12345`);
  } else {
    // Keep an existing admin checkout-ready even if it was seeded before this fix.
    await User.updateOne({ email: adminEmail }, { $set: { emailVerified: true } });
  }

  log(`[seed] Inserted ${seedBooks.length} books, ${seedCategories.length} categories, ${seedPlans.length} plans.`);
};

const run = async () => {
  await connectDB();

  try {
    if (process.argv.includes("--destroy")) {
      await destroy();
    } else {
      await importData();
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[seed] Failed:", error);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
};

run();
