import request from "supertest";
import { createApp } from "../app";
import { Book } from "../models/Book";

const app = createApp();

const makeBook = (overrides: Partial<Record<string, unknown>> = {}) => ({
  title: "Test Book",
  author: "Test Author",
  image: "/books/book1.jpg",
  category: "Fiction",
  rentPrice: 20,
  buyPrice: 100,
  description: "A test book.",
  language: "English",
  stock: 5,
  tags: ["test"],
  ...overrides,
});

describe("Books", () => {
  it("lists books with pagination metadata", async () => {
    await Book.create([
      makeBook({ title: "Book One" }),
      makeBook({ title: "Book Two" }),
      makeBook({ title: "Book Three" }),
    ]);

    const res = await request(app).get("/api/books").query({ limit: 2, page: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBe(3);
    expect(res.body.meta.totalPages).toBe(2);
  });

  it("filters books by category", async () => {
    await Book.create([makeBook({ category: "Fiction" }), makeBook({ category: "History" })]);

    const res = await request(app).get("/api/books").query({ category: "History" });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].category).toBe("History");
  });

  it("404s for a book id that doesn't exist", async () => {
    const res = await request(app).get("/api/books/64b000000000000000000000");
    expect(res.status).toBe(404);
  });

  it("resolves a normalized ISBN to a catalog book regardless of dash formatting", async () => {
    await Book.create(makeBook({ title: "Atomic Habits", isbn: "978-0735211292" }));

    const auth = await request(app).post("/api/auth/register").send({
      name: "Isbn Tester",
      email: "isbn@test.dev",
      password: "TestPass@123",
    });
    const token = auth.body.data.accessToken;

    const res = await request(app)
      .get("/api/books/by-isbn/9780735211292")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe("catalog");
    expect(res.body.data.alreadyInCatalog).toBe(true);
    expect(res.body.data.title).toBe("Atomic Habits");
  });

  it("returns a clean not-found for an ISBN with no match or external lookup", async () => {
    const auth = await request(app).post("/api/auth/register").send({
      name: "Isbn Tester 2",
      email: "isbn2@test.dev",
      password: "TestPass@123",
    });
    const token = auth.body.data.accessToken;

    const res = await request(app)
      .get("/api/books/by-isbn/0000000000000")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/couldn't find a book/i);
  });
});
