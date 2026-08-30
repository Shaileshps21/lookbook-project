import request from "supertest";
import { createApp } from "../app";
import { User } from "../models/User";
import { shouldSendEmail } from "../utils/mailer";

const app = createApp();

describe("Email preferences", () => {
  it("defaults every preference to true for a new account", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Prefs Tester", email: "prefs1@example.com", password: "TestPass@123" });

    expect(res.body.data.user.emailPreferences).toEqual({
      orderUpdates: true,
      rentalReminders: true,
      priceDropAlerts: true,
      sellerNotifications: true,
      marketing: true,
    });
  });

  it("PATCH /api/users/me/email-preferences merges partial updates", async () => {
    const reg = await request(app)
      .post("/api/auth/register")
      .send({ name: "Prefs Tester", email: "prefs2@example.com", password: "TestPass@123" });
    const token = reg.body.data.accessToken as string;

    const res = await request(app)
      .patch("/api/users/me/email-preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ rentalReminders: false, marketing: false });

    expect(res.status).toBe(200);
    expect(res.body.data.emailPreferences).toMatchObject({
      orderUpdates: true,
      rentalReminders: false,
      priceDropAlerts: true,
      sellerNotifications: true,
      marketing: false,
    });
  });

  it("shouldSendEmail respects a disabled category and defaults others to true", async () => {
    const reg = await request(app)
      .post("/api/auth/register")
      .send({ name: "Prefs Tester", email: "prefs3@example.com", password: "TestPass@123" });
    const token = reg.body.data.accessToken as string;
    const userId = reg.body.data.user.id as string;

    await request(app)
      .patch("/api/users/me/email-preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ priceDropAlerts: false });

    expect(await shouldSendEmail(userId, "priceDropAlerts")).toBe(false);
    expect(await shouldSendEmail(userId, "orderUpdates")).toBe(true);
  });

  it("rejects an empty preferences body", async () => {
    const reg = await request(app)
      .post("/api/auth/register")
      .send({ name: "Prefs Tester", email: "prefs4@example.com", password: "TestPass@123" });
    const token = reg.body.data.accessToken as string;

    const res = await request(app)
      .patch("/api/users/me/email-preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

describe("User model default", () => {
  it("backfills emailPreferences defaults for a document created before the field existed", async () => {
    const user = await User.create({ name: "Legacy", email: "legacy1@example.com", password: "TestPass@123" });
    // Simulate a pre-migration document: strip the field at the storage layer.
    await User.collection.updateOne({ _id: user._id }, { $unset: { emailPreferences: "" } });

    const reloaded = await User.findById(user._id);
    expect(reloaded?.emailPreferences?.orderUpdates).toBe(true);
  });
});
