import request from "supertest";
import { createApp } from "../app";
import { Book } from "../models/Book";
import { Order } from "../models/Order";
import { User } from "../models/User";

const app = createApp();

const registerAndGetToken = async (email: string) => {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name: "Challenge Tester", email, password: "TestPass@123" });
  return { token: res.body.data.accessToken as string, userId: res.body.data.user.id as string };
};

const createTestBook = async (category = "Fiction") =>
  Book.create({
    title: "Challenge Test Book",
    author: "Author",
    image: "/books/book1.jpg",
    category,
    rentPrice: 20,
    buyPrice: 100,
    description: "desc",
    language: "English",
    stock: 5,
    tags: [],
  });

/** Gives a user an owned book (an Order line item) and marks it finished —
 * the only way `markBookFinished` allows a "finished" activity to be logged,
 * matching the real product flow. */
const finishBook = async (token: string, userId: string, bookId: string) => {
  await Order.create({
    user: userId,
    items: [{ book: bookId, mode: "buy", quantity: 1, price: 100 }],
    subtotal: 100,
    delivery: 0,
    total: 100,
    status: "Delivered",
    paymentStatus: "paid",
  });
  return request(app).post(`/api/reading/finish/${bookId}`).set("Authorization", `Bearer ${token}`);
};

const createChallenge = async (
  token: string,
  overrides: Partial<{ title: string; target: number; type: string; genre: string; clubId: string; official: boolean }> = {}
) => {
  const now = new Date();
  const res = await request(app)
    .post("/api/challenges")
    .set("Authorization", `Bearer ${token}`)
    .send({
      title: overrides.title ?? "Test Challenge",
      target: overrides.target ?? 1,
      type: overrides.type,
      genre: overrides.genre,
      clubId: overrides.clubId,
      official: overrides.official,
      periodStart: new Date(now.getTime() - 86_400_000).toISOString(),
      periodEnd: new Date(now.getTime() + 30 * 86_400_000).toISOString(),
    });
  return res;
};

describe("Challenges — join/leave and non-admin creation", () => {
  it("any logged-in user can create a challenge, and it starts unjoined for others", async () => {
    const { token } = await registerAndGetToken("challenger1@example.com");
    const res = await createChallenge(token);
    expect(res.status).toBe(201);
    expect(res.body.data.joined).toBe(false);
    expect(res.body.data.official).toBe(false);
  });

  it("a normal user's 'official' flag is silently ignored — only an admin can set it", async () => {
    const { token, userId } = await registerAndGetToken("notadmin1@example.com");
    const res = await createChallenge(token, { official: true });
    expect(res.body.data.official).toBe(false);

    await User.updateOne({ _id: userId }, { role: "admin" });
    const adminRes = await createChallenge(token, { title: "Official Challenge", official: true });
    expect(adminRes.body.data.official).toBe(true);
  });

  it("join/leave toggles participantsCount and 'joined' on subsequent reads", async () => {
    const { token: creatorToken } = await registerAndGetToken("creator1@example.com");
    const { token: joinerToken } = await registerAndGetToken("joiner2@example.com");
    const created = await createChallenge(creatorToken);
    const challengeId = created.body.data.id as string;

    const join = await request(app).post(`/api/challenges/${challengeId}/join`).set("Authorization", `Bearer ${joinerToken}`);
    expect(join.status).toBe(200);
    expect(join.body.data.joined).toBe(true);

    const list = await request(app).get("/api/challenges").set("Authorization", `Bearer ${joinerToken}`);
    const found = list.body.data.find((c: { id: string }) => c.id === challengeId);
    expect(found.joined).toBe(true);
    expect(found.participantsCount).toBe(1);

    const leave = await request(app).delete(`/api/challenges/${challengeId}/join`).set("Authorization", `Bearer ${joinerToken}`);
    expect(leave.status).toBe(200);
    expect(leave.body.data.joined).toBe(false);

    const listAfter = await request(app).get("/api/challenges").set("Authorization", `Bearer ${joinerToken}`);
    const foundAfter = listAfter.body.data.find((c: { id: string }) => c.id === challengeId);
    expect(foundAfter.participantsCount).toBe(0);
  });

  it("club-scoped creation requires membership in that club", async () => {
    const { token: ownerToken } = await registerAndGetToken("clubowner-ch1@example.com");
    const { token: outsiderToken } = await registerAndGetToken("outsider-ch1@example.com");
    const club = await request(app).post("/api/clubs").set("Authorization", `Bearer ${ownerToken}`).send({ name: "Challenge Club" });
    const clubId = club.body.data.id as string;

    const denied = await createChallenge(outsiderToken, { clubId });
    expect(denied.status).toBe(403);

    const allowed = await createChallenge(ownerToken, { clubId });
    expect(allowed.status).toBe(201);
    expect(allowed.body.data.club.id).toBe(clubId);
  });

  it("checking progress auto-joins the user, and awards a badge exactly once target is reached", async () => {
    const { token, userId } = await registerAndGetToken("progress1@example.com");
    const book = await createTestBook();
    const created = await createChallenge(token, { target: 1 });
    const challengeId = created.body.data.id as string;

    const before = await request(app).get(`/api/challenges/${challengeId}/progress`).set("Authorization", `Bearer ${token}`);
    expect(before.body.data.progress).toBe(0);
    expect(before.body.data.completed).toBe(false);

    const joinedCheck = await request(app).get("/api/challenges").set("Authorization", `Bearer ${token}`);
    expect(joinedCheck.body.data.find((c: { id: string }) => c.id === challengeId).joined).toBe(true);

    await finishBook(token, userId, book.id);

    const after = await request(app).get(`/api/challenges/${challengeId}/progress`).set("Authorization", `Bearer ${token}`);
    expect(after.body.data.progress).toBe(1);
    expect(after.body.data.completed).toBe(true);
    expect(after.body.data.justCompleted).toBe(true);

    const badges = await request(app).get("/api/challenges/badges/mine").set("Authorization", `Bearer ${token}`);
    expect(badges.body.data).toHaveLength(1);

    const again = await request(app).get(`/api/challenges/${challengeId}/progress`).set("Authorization", `Bearer ${token}`);
    expect(again.body.data.justCompleted).toBe(false);
  });

  it("a genre-type challenge only counts finished books matching that genre", async () => {
    const { token, userId } = await registerAndGetToken("genre1@example.com");
    const fictionBook = await createTestBook("Fiction");
    const historyBook = await createTestBook("History");
    const created = await createChallenge(token, { type: "genre", genre: "Fiction", target: 1 });
    const challengeId = created.body.data.id as string;

    await finishBook(token, userId, historyBook.id);
    const afterHistory = await request(app).get(`/api/challenges/${challengeId}/progress`).set("Authorization", `Bearer ${token}`);
    expect(afterHistory.body.data.progress).toBe(0);

    await finishBook(token, userId, fictionBook.id);
    const afterFiction = await request(app).get(`/api/challenges/${challengeId}/progress`).set("Authorization", `Bearer ${token}`);
    expect(afterFiction.body.data.progress).toBe(1);
    expect(afterFiction.body.data.completed).toBe(true);
  });

  it("leaderboard only ranks joined participants, and includes the viewer's own row when unranked", async () => {
    const { token: aToken, userId: aId } = await registerAndGetToken("board-a@example.com");
    const { token: bToken } = await registerAndGetToken("board-b@example.com");
    const book = await createTestBook();
    const created = await createChallenge(aToken, { target: 1 });
    const challengeId = created.body.data.id as string;

    // b finishes a qualifying book but never joins — should not appear.
    await finishBook(bToken, (await User.findOne({ email: "board-b@example.com" }))!.id, book.id);

    // a joins (via progress check) but hasn't finished anything yet.
    await request(app).get(`/api/challenges/${challengeId}/progress`).set("Authorization", `Bearer ${aToken}`);

    const board = await request(app).get(`/api/challenges/${challengeId}/leaderboard`).set("Authorization", `Bearer ${aToken}`);
    expect(board.status).toBe(200);
    expect(board.body.data.rows.find((r: { userId: string }) => r.userId === aId)).toBeUndefined();
    expect(board.body.data.rows).toHaveLength(0);
    expect(board.body.data.viewerRank).toMatchObject({ userId: aId, booksFinished: 0 });
    expect(board.body.data.totalParticipants).toBe(1);
  });
});
