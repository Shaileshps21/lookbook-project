import request from "supertest";
import { createApp } from "../app";
import { Book } from "../models/Book";
import { Coupon } from "../models/Coupon";
import { User } from "../models/User";
import { validateCouponForCart } from "../utils/coupon";

const app = createApp();
const DAY_MS = 24 * 60 * 60 * 1000;

const registerAndGetToken = async (email: string, isAdmin = false) => {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name: "Coupon Tester", email, password: "TestPass@123" });
  if (isAdmin) {
    await User.updateOne({ email }, { role: "admin" });
    const login = await request(app).post("/api/auth/login").send({ email, password: "TestPass@123" });
    return { token: login.body.data.accessToken as string, userId: res.body.data.user.id as string };
  }
  return { token: res.body.data.accessToken as string, userId: res.body.data.user.id as string };
};

describe("validateCouponForCart (unit)", () => {
  it("rejects an unknown code", async () => {
    const result = await validateCouponForCart("NOPE", 500);
    expect(result.valid).toBe(false);
  });

  it("rejects an inactive coupon", async () => {
    await Coupon.create({ code: "OFF10", discountType: "percent", discountValue: 10, active: false });
    const result = await validateCouponForCart("OFF10", 500);
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/no longer active/i);
  });

  it("rejects an expired coupon", async () => {
    await Coupon.create({
      code: "EXPIRED5",
      discountType: "flat",
      discountValue: 50,
      expiresAt: new Date(Date.now() - DAY_MS),
    });
    const result = await validateCouponForCart("EXPIRED5", 500);
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/expired/i);
  });

  it("rejects a coupon that has hit its usage limit", async () => {
    await Coupon.create({ code: "MAXED", discountType: "flat", discountValue: 50, maxUses: 2, usedCount: 2 });
    const result = await validateCouponForCart("MAXED", 500);
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/usage limit/i);
  });

  it("rejects a cart below the coupon's minimum order value", async () => {
    await Coupon.create({ code: "BIGORDER", discountType: "flat", discountValue: 50, minOrderValue: 1000 });
    const result = await validateCouponForCart("BIGORDER", 500);
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/minimum order/i);
  });

  it("computes a percent discount, rounded, and caps a flat discount at the cart total", async () => {
    await Coupon.create({ code: "PCT20", discountType: "percent", discountValue: 20 });
    const percentResult = await validateCouponForCart("PCT20", 333);
    expect(percentResult.valid).toBe(true);
    expect(percentResult.discountAmount).toBe(67); // round(333 * 0.2) = 66.6 -> 67
    expect(percentResult.finalTotal).toBe(266);

    await Coupon.create({ code: "FLAT500", discountType: "flat", discountValue: 500 });
    const flatResult = await validateCouponForCart("FLAT500", 200);
    expect(flatResult.valid).toBe(true);
    expect(flatResult.discountAmount).toBe(200); // capped at cart total
    expect(flatResult.finalTotal).toBe(0);
  });

  it("is case-insensitive on the code", async () => {
    await Coupon.create({ code: "SAVE15", discountType: "percent", discountValue: 15 });
    const result = await validateCouponForCart("save15", 400);
    expect(result.valid).toBe(true);
  });
});

describe("POST /api/coupons/validate", () => {
  it("returns the same shape a logged-in user would see", async () => {
    const { token } = await registerAndGetToken("coupon1@example.com");
    await Coupon.create({ code: "WELCOME10", discountType: "percent", discountValue: 10 });

    const res = await request(app)
      .post("/api/coupons/validate")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "WELCOME10", cartTotal: 300 });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ valid: true, discountAmount: 30, finalTotal: 270 });
  });
});

describe("Admin coupon CRUD", () => {
  it("only an admin can create a coupon, and a duplicate code is rejected", async () => {
    const { token: userToken } = await registerAndGetToken("coupon2@example.com");
    const { token: adminToken } = await registerAndGetToken("couponadmin1@example.com", true);

    const forbidden = await request(app)
      .post("/api/admin/coupons")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ code: "ADMIN1", discountType: "flat", discountValue: 50 });
    expect(forbidden.status).toBe(403);

    const created = await request(app)
      .post("/api/admin/coupons")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ code: "admin1", discountType: "flat", discountValue: 50 });
    expect(created.status).toBe(201);
    expect(created.body.data.code).toBe("ADMIN1"); // auto-uppercased

    const duplicate = await request(app)
      .post("/api/admin/coupons")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ code: "ADMIN1", discountType: "flat", discountValue: 20 });
    expect(duplicate.status).toBe(409);
  });

  it("PATCH toggles active without affecting other fields, DELETE soft-deletes", async () => {
    const { token: adminToken } = await registerAndGetToken("couponadmin2@example.com", true);

    const created = await request(app)
      .post("/api/admin/coupons")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ code: "TOGGLEME", discountType: "flat", discountValue: 25, maxUses: 5 });
    const id = created.body.data.id as string;

    const toggled = await request(app)
      .patch(`/api/admin/coupons/${id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ active: false });
    expect(toggled.status).toBe(200);
    expect(toggled.body.data.active).toBe(false);
    expect(toggled.body.data.maxUses).toBe(5);

    const deleted = await request(app).delete(`/api/admin/coupons/${id}`).set("Authorization", `Bearer ${adminToken}`);
    expect(deleted.status).toBe(200);
    expect(deleted.body.data.active).toBe(false);
  });
});

describe("Checkout coupon integration", () => {
  const createTestBook = async () =>
    Book.create({
      title: "Coupon Checkout Book",
      author: "Author",
      category: "Fiction",
      rentPrice: 20,
      buyPrice: 500,
      description: "desc",
      language: "English",
      stock: 5,
      tags: [],
    });

  it("rejects checkout with an invalid coupon before creating any order or contacting a payment provider", async () => {
    const { token } = await registerAndGetToken("couponcheckout1@example.com");
    const book = await createTestBook();

    await request(app)
      .post("/api/cart")
      .set("Authorization", `Bearer ${token}`)
      .send({ bookId: book.id, mode: "buy", quantity: 1 });

    const res = await request(app)
      .post("/api/orders/checkout")
      .set("Authorization", `Bearer ${token}`)
      .send({ couponCode: "DOES-NOT-EXIST" });

    expect(res.status).toBe(400);

    const orders = await request(app).get("/api/orders").set("Authorization", `Bearer ${token}`);
    expect(orders.body.data).toHaveLength(0);
  });

  it("applies the coupon discount to the created order's total (Razorpay order-creation network call mocked)", async () => {
    const { token } = await registerAndGetToken("couponcheckout2@example.com");
    const book = await createTestBook();
    await Coupon.create({ code: "SAVE50", discountType: "flat", discountValue: 50 });

    await request(app)
      .post("/api/cart")
      .set("Authorization", `Bearer ${token}`)
      .send({ bookId: book.id, mode: "buy", quantity: 1 });

    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ id: "order_fake123", amount: 45000, currency: "INR" }),
    } as Response);

    try {
      const res = await request(app)
        .post("/api/orders/checkout")
        .set("Authorization", `Bearer ${token}`)
        .send({ couponCode: "save50" });

      expect(res.status).toBe(201);
      // subtotal 500 + delivery 40 = 540, minus flat 50 = 490
      expect(res.body.data.order.discountAmount).toBe(50);
      expect(res.body.data.order.couponCode).toBe("SAVE50");
      expect(res.body.data.order.total).toBe(490);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
