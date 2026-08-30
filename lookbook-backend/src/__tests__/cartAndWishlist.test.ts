import request from "supertest";
import { createApp } from "../app";
import { Book } from "../models/Book";

const app = createApp();

const registerAndGetToken = async (email: string): Promise<string> => {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name: "Cart Tester", email, password: "TestPass@123" });
  return res.body.data.accessToken as string;
};

const createTestBook = async () =>
  Book.create({
    title: "Cart Test Book",
    author: "Author",
    image: "/books/book1.jpg",
    category: "Fiction",
    rentPrice: 20,
    buyPrice: 100,
    description: "desc",
    language: "English",
    stock: 5,
    tags: [],
  });

describe("Cart and Wishlist", () => {
  it("adds a book to the cart and reflects it in GET /api/cart", async () => {
    const token = await registerAndGetToken("cart1@example.com");
    const book = await createTestBook();

    const add = await request(app)
      .post("/api/cart")
      .set("Authorization", `Bearer ${token}`)
      .send({ bookId: book.id, mode: "buy", quantity: 1 });
    expect(add.status).toBe(201);

    const get = await request(app).get("/api/cart").set("Authorization", `Bearer ${token}`);
    expect(get.status).toBe(200);
    expect(get.body.data.items).toHaveLength(1);
    expect(get.body.data.items[0].book.id).toBe(book.id);
    expect(get.body.data.subtotal).toBe(100);
  });

  it("toggles a book on and off the wishlist", async () => {
    const token = await registerAndGetToken("wishlist1@example.com");
    const book = await createTestBook();

    const addRes = await request(app)
      .post(`/api/wishlist/${book.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(addRes.status).toBe(200);
    expect(addRes.body.data).toHaveLength(1);

    const removeRes = await request(app)
      .post(`/api/wishlist/${book.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(removeRes.status).toBe(200);
    expect(removeRes.body.data).toHaveLength(0);
  });

  it("rejects cart/wishlist actions without auth", async () => {
    const book = await createTestBook();
    const res = await request(app).post(`/api/wishlist/${book.id}`);
    expect(res.status).toBe(401);
  });
});
