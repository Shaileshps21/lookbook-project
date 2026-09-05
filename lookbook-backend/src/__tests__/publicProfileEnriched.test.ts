import request from "supertest";
import { createApp } from "../app";
import { Book } from "../models/Book";
import { Order } from "../models/Order";
import { User } from "../models/User";

const app = createApp();

const register = async (email: string, name: string) => {
  const res = await request(app).post("/api/auth/register").send({ name, email, password: "TestPass@123" });
  return { token: res.body.data.accessToken as string, userId: res.body.data.user.id as string };
};

const makePublic = (token: string) =>
  request(app).patch("/api/users/public-profile").set("Authorization", `Bearer ${token}`).send({ publicProfile: true });

const createTestBook = async () =>
  Book.create({
    title: "Profile Test Book",
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

describe("GET /api/users/:userId/public-profile — enriched fields", () => {
  it("stays 404 for a non-public profile, revealing nothing", async () => {
    const { userId } = await register("priv-profile1@example.com", "Private Person");
    const res = await request(app).get(`/api/users/${userId}/public-profile`);
    expect(res.status).toBe(404);
  });

  it("includes readingStats, badges, challengesInProgress, and clubs for a public profile", async () => {
    const { token, userId } = await register("rich-profile1@example.com", "Rich Profile");
    await makePublic(token);
    const book = await createTestBook();

    await Order.create({
      user: userId,
      items: [{ book: book.id, mode: "buy", quantity: 1, price: 100 }],
      subtotal: 100,
      delivery: 0,
      total: 100,
      status: "Delivered",
      paymentStatus: "paid",
    });
    await request(app).post(`/api/reading/finish/${book.id}`).set("Authorization", `Bearer ${token}`);

    const club = await request(app).post("/api/clubs").set("Authorization", `Bearer ${token}`).send({ name: "Rich Profile Club" });

    const now = new Date();
    const challenge = await request(app)
      .post("/api/challenges")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Profile Challenge",
        target: 5,
        periodStart: new Date(now.getTime() - 86_400_000).toISOString(),
        periodEnd: new Date(now.getTime() + 30 * 86_400_000).toISOString(),
      });
    await request(app).post(`/api/challenges/${challenge.body.data.id}/join`).set("Authorization", `Bearer ${token}`);

    const res = await request(app).get(`/api/users/${userId}/public-profile`);
    expect(res.status).toBe(200);
    expect(res.body.data.readingStats.booksRead).toBe(1);
    expect(res.body.data.readingStats.favouriteGenres).toContain("Fiction");
    expect(res.body.data.clubs).toEqual(expect.arrayContaining([expect.objectContaining({ id: club.body.data.id })]));
    expect(res.body.data.challengesInProgress).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: challenge.body.data.id, target: 5, progress: 1 })])
    );
  });

  it("reports mutual followers between the viewer and the profile owner", async () => {
    const { token: ownerToken, userId: ownerId } = await register("mutual-owner@example.com", "Mutual Owner");
    await makePublic(ownerToken);
    const { token: mutualToken, userId: mutualId } = await register("mutual-friend@example.com", "Mutual Friend");
    const { token: viewerToken } = await register("mutual-viewer@example.com", "Mutual Viewer");

    // Both the viewer and the mutual friend follow the profile owner.
    await request(app).post(`/api/follow/${ownerId}`).set("Authorization", `Bearer ${mutualToken}`);
    await request(app).post(`/api/follow/${ownerId}`).set("Authorization", `Bearer ${viewerToken}`);
    // The viewer also follows the mutual friend, making them mutual.
    await request(app).post(`/api/follow/${mutualId}`).set("Authorization", `Bearer ${viewerToken}`);

    const res = await request(app)
      .get(`/api/users/${ownerId}/public-profile`)
      .set("Authorization", `Bearer ${viewerToken}`);

    expect(res.body.data.mutualFollowers).toEqual(expect.arrayContaining([expect.objectContaining({ id: mutualId })]));
    expect(res.body.data.mutualFollowersCount).toBeGreaterThanOrEqual(1);
  });

  it("badges appear once a challenge is completed, and drop out of challengesInProgress", async () => {
    const { token, userId } = await register("badge-profile1@example.com", "Badge Profile");
    await makePublic(token);
    const book = await createTestBook();
    await Order.create({
      user: userId,
      items: [{ book: book.id, mode: "buy", quantity: 1, price: 100 }],
      subtotal: 100,
      delivery: 0,
      total: 100,
      status: "Delivered",
      paymentStatus: "paid",
    });

    const now = new Date();
    const challenge = await request(app)
      .post("/api/challenges")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "One Book Challenge",
        target: 1,
        periodStart: new Date(now.getTime() - 86_400_000).toISOString(),
        periodEnd: new Date(now.getTime() + 30 * 86_400_000).toISOString(),
      });

    await request(app).post(`/api/reading/finish/${book.id}`).set("Authorization", `Bearer ${token}`);
    await request(app).get(`/api/challenges/${challenge.body.data.id}/progress`).set("Authorization", `Bearer ${token}`);

    const res = await request(app).get(`/api/users/${userId}/public-profile`);
    expect(res.body.data.badges).toHaveLength(1);
    expect(res.body.data.challengesInProgress.find((c: { id: string }) => c.id === challenge.body.data.id)).toBeUndefined();
  });
});

// Sanity: role field untouched by any of this — enrichment is additive only.
describe("public profile enrichment doesn't affect base auth", () => {
  it("registering still returns a plain user role", async () => {
    const { userId } = await register("sanity-check1@example.com", "Sanity Check");
    const user = await User.findById(userId);
    expect(user?.role).toBe("user");
  });
});
