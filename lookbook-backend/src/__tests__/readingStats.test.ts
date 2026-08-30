import request from "supertest";
import { createApp } from "../app";
import { Book } from "../models/Book";
import { Order } from "../models/Order";

const app = createApp();

const registerAndGetToken = async (email: string) => {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name: "Reading Tester", email, password: "TestPass@123" });
  return { token: res.body.data.accessToken as string, userId: res.body.data.user.id as string };
};

const createTestBook = async (overrides: Partial<{ category: string }> = {}) =>
  Book.create({
    title: "Reading Stats Test Book",
    author: "Author",
    image: "/books/book1.jpg",
    category: overrides.category ?? "Fiction",
    rentPrice: 20,
    buyPrice: 100,
    description: "desc",
    language: "English",
    stock: 5,
    tags: [],
  });

describe("GET /api/reading/stats", () => {
  it("returns a 12-entry monthlyBooks series and a genreBreakdown derived from order history", async () => {
    const { token, userId } = await registerAndGetToken("reading1@example.com");
    const fictionBook = await createTestBook({ category: "Fiction" });
    const historyBook = await createTestBook({ category: "History" });

    await Order.create({
      user: userId,
      items: [
        { book: fictionBook.id, mode: "buy", quantity: 1, price: 100 },
        { book: historyBook.id, mode: "buy", quantity: 1, price: 100 },
      ],
      subtotal: 200,
      delivery: 0,
      total: 200,
      status: "Delivered",
      paymentStatus: "paid",
    });

    await request(app).post(`/api/reading/finish/${fictionBook.id}`).set("Authorization", `Bearer ${token}`);

    const res = await request(app).get("/api/reading/stats").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.monthlyBooks).toHaveLength(12);
    expect(res.body.data.monthlyBooks.every((m: { month: string; count: number }) => typeof m.month === "string")).toBe(true);
    expect(res.body.data.monthlyBooks.reduce((sum: number, m: { count: number }) => sum + m.count, 0)).toBe(1);

    const genres = res.body.data.genreBreakdown as { genre: string; count: number }[];
    expect(genres.find((g) => g.genre === "Fiction")?.count).toBe(1);
    expect(genres.find((g) => g.genre === "History")?.count).toBe(1);
  });
});
