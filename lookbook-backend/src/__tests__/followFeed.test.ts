import request from "supertest";
import { createApp } from "../app";
import { Book } from "../models/Book";
import { Review } from "../models/Review";
import { UserActivity } from "../models/UserActivity";

const app = createApp();

const registerAndGetToken = async (email: string) => {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name: `Feed ${email}`, email, password: "TestPass@123" });
  return { token: res.body.data.accessToken as string, userId: res.body.data.user.id as string };
};

const createTestBook = async () =>
  Book.create({
    title: "Feed Test Book",
    author: "Author",
    category: "Fiction",
    rentPrice: 20,
    buyPrice: 100,
    description: "desc",
    language: "English",
    stock: 5,
    tags: [],
  });

describe("GET /api/follow/feed", () => {
  it("merges reviews and finished activity from followed users, newest first, and paginates", async () => {
    const { token: viewerToken } = await registerAndGetToken("feedviewer1@example.com");
    const { userId: authorId } = await registerAndGetToken("feedauthor1@example.com");
    const book = await createTestBook();

    await request(app).post(`/api/follow/${authorId}`).set("Authorization", `Bearer ${viewerToken}`);

    await Review.create({ book: book.id, user: authorId, name: "Author", rating: 5, comment: "Loved it" });
    await UserActivity.create({ user: authorId, book: book.id, action: "finished", weight: 2 });

    const res = await request(app).get("/api/follow/feed").set("Authorization", `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.map((i: { type: string }) => i.type).sort()).toEqual(["activity", "review"]);
    expect(res.body.meta.hasMore).toBe(false);

    const page1 = await request(app)
      .get("/api/follow/feed")
      .query({ limit: 1 })
      .set("Authorization", `Bearer ${viewerToken}`);
    expect(page1.body.data).toHaveLength(1);
    expect(page1.body.meta.hasMore).toBe(true);
  });

  it("returns an empty feed with hasMore false when following no one", async () => {
    const { token } = await registerAndGetToken("feedlonely1@example.com");
    const res = await request(app).get("/api/follow/feed").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.hasMore).toBe(false);
  });
});

describe("GET /api/follow/suggestions", () => {
  it("excludes users already followed and non-public profiles", async () => {
    const { token: viewerToken, userId: viewerId } = await registerAndGetToken("suggviewer1@example.com");
    const { token: publicToken, userId: publicId } = await registerAndGetToken("suggpublic1@example.com");
    const { userId: privateId } = await registerAndGetToken("suggprivate1@example.com");
    const book = await createTestBook();

    await request(app)
      .patch("/api/users/public-profile")
      .set("Authorization", `Bearer ${publicToken}`)
      .send({ publicProfile: true });

    await Review.create({ book: book.id, user: publicId, name: "Public", rating: 4, comment: "Good" });
    await Review.create({ book: book.id, user: privateId, name: "Private", rating: 4, comment: "Good" });

    const res = await request(app).get("/api/follow/suggestions").set("Authorization", `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((s: { id: string }) => s.id);
    expect(ids).toContain(publicId);
    expect(ids).not.toContain(privateId);
    expect(ids).not.toContain(viewerId);
  });
});
