import request from "supertest";
import { createApp } from "../app";
import { Book } from "../models/Book";
import { Order } from "../models/Order";

const app = createApp();
const DAY_MS = 24 * 60 * 60 * 1000;

const registerAndGetToken = async (email: string) => {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name: "Pickup Tester", email, password: "TestPass@123" });
  return { token: res.body.data.accessToken as string, userId: res.body.data.user.id as string };
};

const createTestBook = async () =>
  Book.create({
    title: "Pickup Test Book",
    author: "Author",
    category: "Fiction",
    rentPrice: 20,
    buyPrice: 100,
    description: "desc",
    language: "English",
    stock: 5,
    tags: [],
  });

describe("POST /api/orders/:id/items/:itemIndex/schedule-pickup", () => {
  it("schedules a pickup within the next 7 days and rejects an out-of-window date", async () => {
    const { token, userId } = await registerAndGetToken("pickup1@example.com");
    const book = await createTestBook();
    const order = await Order.create({
      user: userId,
      items: [{ book: book.id, mode: "rent", quantity: 1, price: 20, dueDate: new Date(Date.now() + DAY_MS) }],
      subtotal: 20,
      delivery: 0,
      total: 20,
      status: "Active",
      paymentStatus: "paid",
    });

    const inWindow = new Date(Date.now() + 2 * DAY_MS).toISOString();
    const ok = await request(app)
      .post(`/api/orders/${order.id}/items/0/schedule-pickup`)
      .set("Authorization", `Bearer ${token}`)
      .send({ pickupDate: inWindow, pickupTimeSlot: "morning" });

    expect(ok.status).toBe(200);
    expect(ok.body.data.items[0].pickupTimeSlot).toBe("morning");
    expect(ok.body.data.items[0].pickupDate).toBeDefined();

    const tooFar = new Date(Date.now() + 20 * DAY_MS).toISOString();
    const bad = await request(app)
      .post(`/api/orders/${order.id}/items/0/schedule-pickup`)
      .set("Authorization", `Bearer ${token}`)
      .send({ pickupDate: tooFar, pickupTimeSlot: "morning" });

    expect(bad.status).toBe(400);
  });

  it("rejects an invalid time slot", async () => {
    const { token, userId } = await registerAndGetToken("pickup2@example.com");
    const book = await createTestBook();
    const order = await Order.create({
      user: userId,
      items: [{ book: book.id, mode: "rent", quantity: 1, price: 20, dueDate: new Date(Date.now() + DAY_MS) }],
      subtotal: 20,
      delivery: 0,
      total: 20,
      status: "Active",
      paymentStatus: "paid",
    });

    const res = await request(app)
      .post(`/api/orders/${order.id}/items/0/schedule-pickup`)
      .set("Authorization", `Bearer ${token}`)
      .send({ pickupDate: new Date(Date.now() + DAY_MS).toISOString(), pickupTimeSlot: "midnight" });

    expect(res.status).toBe(400);
  });
});
