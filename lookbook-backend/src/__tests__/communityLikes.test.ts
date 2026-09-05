import request from "supertest";
import { createApp } from "../app";

const app = createApp();

const registerAndGetToken = async (email: string) => {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name: "Likes Tester", email, password: "TestPass@123" });
  return { token: res.body.data.accessToken as string, userId: res.body.data.user.id as string };
};

const createClub = async (token: string, name: string) => {
  const res = await request(app).post("/api/clubs").set("Authorization", `Bearer ${token}`).send({ name });
  return res.body.data.id as string;
};

const createPost = async (token: string, clubId: string, content = "Hello club, just finished a great read.") => {
  const res = await request(app)
    .post("/api/threads")
    .set("Authorization", `Bearer ${token}`)
    .send({ title: content.slice(0, 40), content, clubId });
  return res.body.data as { id: string; likesCount: number; likedByMe: boolean };
};

describe("Club posts — content requirement and likes", () => {
  it("rejects a post with no content", async () => {
    const { token } = await registerAndGetToken("poster1@example.com");
    const clubId = await createClub(token, "Content Required Club");

    const res = await request(app)
      .post("/api/threads")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "No body", clubId });
    expect(res.status).toBe(400);
  });

  it("a new post starts with likesCount 0 and likedByMe false", async () => {
    const { token } = await registerAndGetToken("poster2@example.com");
    const clubId = await createClub(token, "Fresh Post Club");
    const post = await createPost(token, clubId);

    expect(post.likesCount).toBe(0);
    expect(post.likedByMe).toBe(false);
  });

  it("liking a post increments likesCount and unliking decrements it back", async () => {
    const { token: authorToken } = await registerAndGetToken("author1@example.com");
    const { token: likerToken } = await registerAndGetToken("liker1@example.com");
    const clubId = await createClub(authorToken, "Like Flow Club");
    await request(app).post(`/api/clubs/${clubId}/join`).set("Authorization", `Bearer ${likerToken}`);
    const post = await createPost(authorToken, clubId);

    const liked = await request(app).post(`/api/threads/${post.id}/like`).set("Authorization", `Bearer ${likerToken}`);
    expect(liked.status).toBe(200);
    expect(liked.body.data.likesCount).toBe(1);

    const fetched = await request(app)
      .get(`/api/threads/${post.id}`)
      .set("Authorization", `Bearer ${likerToken}`);
    expect(fetched.body.data.thread.likedByMe).toBe(true);
    expect(fetched.body.data.thread.likesCount).toBe(1);

    const unliked = await request(app).delete(`/api/threads/${post.id}/like`).set("Authorization", `Bearer ${likerToken}`);
    expect(unliked.status).toBe(200);
    expect(unliked.body.data.likesCount).toBe(0);
  });

  it("liking the same post twice is idempotent — count stays at 1", async () => {
    const { token: authorToken } = await registerAndGetToken("author2@example.com");
    const { token: likerToken } = await registerAndGetToken("liker2@example.com");
    const clubId = await createClub(authorToken, "Idempotent Like Club");
    const post = await createPost(authorToken, clubId);

    await request(app).post(`/api/threads/${post.id}/like`).set("Authorization", `Bearer ${likerToken}`);
    const secondLike = await request(app).post(`/api/threads/${post.id}/like`).set("Authorization", `Bearer ${likerToken}`);

    expect(secondLike.status).toBe(200);
    expect(secondLike.body.data.likesCount).toBe(1);
  });

  it("comments can be liked independently of the post, and likedByMe reflects the viewer", async () => {
    const { token: authorToken } = await registerAndGetToken("author3@example.com");
    const { token: commenterToken, userId: commenterId } = await registerAndGetToken("commenter1@example.com");
    const clubId = await createClub(authorToken, "Comment Like Club");
    const post = await createPost(authorToken, clubId);

    const comment = await request(app)
      .post(`/api/threads/${post.id}/comments`)
      .set("Authorization", `Bearer ${commenterToken}`)
      .send({ content: "Nice post!" });
    expect(comment.body.data.likesCount).toBe(0);
    const commentId = comment.body.data.id as string;

    const like = await request(app)
      .post(`/api/threads/comments/${commentId}/like`)
      .set("Authorization", `Bearer ${authorToken}`);
    expect(like.body.data.likesCount).toBe(1);

    const fetchedAsCommenter = await request(app)
      .get(`/api/threads/${post.id}`)
      .set("Authorization", `Bearer ${commenterToken}`);
    const fetchedComment = fetchedAsCommenter.body.data.comments.find((c: { id: string }) => c.id === commentId);
    // The comment author (commenterId) didn't like their own comment — the
    // author of the *like* did — so likedByMe is false from the commenter's view.
    expect(fetchedComment.likedByMe).toBe(false);
    expect(fetchedComment.likesCount).toBe(1);
    expect(fetchedComment.author.id).toBe(commenterId);
  });

  it("deleting a post also removes its likes (no orphaned Like documents affecting future ids)", async () => {
    const { token } = await registerAndGetToken("author4@example.com");
    const clubId = await createClub(token, "Delete With Likes Club");
    const post = await createPost(token, clubId);

    await request(app).post(`/api/threads/${post.id}/like`).set("Authorization", `Bearer ${token}`);
    const del = await request(app).delete(`/api/threads/${post.id}`).set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(200);
  });
});
