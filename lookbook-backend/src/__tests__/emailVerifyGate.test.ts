import request from "supertest";
import { createApp } from "../app";
import { User } from "../models/User";

const app = createApp();

describe("Email verification gate", () => {
  const password = "TestPass@123";

  async function tokenFor(tag: string, verified: boolean) {
    const email = `gate-${tag}@example.com`;
    await request(app).post("/api/auth/register").send({ name: "Gate User", email, password });
    // Dev mode auto-verifies every account at registration; flip to false so
    // the gate actually has a path to block.
    await User.updateOne({ email }, { $set: { emailVerified: verified } });
    const res = await request(app).post("/api/auth/login").send({ email, password });
    expect(res.status).toBe(200);
    return res.body.data.accessToken as string;
  }

  const validListing = {
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    category: "Classics",
    price: 250,
    condition: "Good",
  };

  it("blocks checkout for an unverified email", async () => {
    const token = await tokenFor("checkout", false);
    const res = await request(app)
      .post("/api/orders/checkout")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/verify your email/i);
  });

  it("blocks creating a listing for an unverified email", async () => {
    const token = await tokenFor("listing", false);
    const res = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${token}`)
      .send(validListing);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/verify your email/i);
  });

  it("blocks cover-scan for an unverified email", async () => {
    const token = await tokenFor("scan", false);
    const res = await request(app).post("/api/listings/scan").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("allows listing once the email is verified", async () => {
    const token = await tokenFor("verified", true);
    const res = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${token}`)
      .send(validListing);
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty("id");
  });
});