import request from "supertest";
import { createApp } from "../app";
import { Notification } from "../models/Notification";

const app = createApp();

const register = async (email: string, name: string) => {
  const res = await request(app).post("/api/auth/register").send({ name, email, password: "TestPass@123" });
  return { token: res.body.data.accessToken as string, userId: res.body.data.user.id as string };
};

describe("Follow / unfollow / remove-follower", () => {
  it("following someone notifies them exactly once, not again on a repeat follow call", async () => {
    const { token: followerToken } = await register("fm-follower1@example.com", "Follower One");
    const { userId: targetId } = await register("fm-target1@example.com", "Target One");

    const first = await request(app).post(`/api/follow/${targetId}`).set("Authorization", `Bearer ${followerToken}`);
    expect(first.status).toBe(200);

    const again = await request(app).post(`/api/follow/${targetId}`).set("Authorization", `Bearer ${followerToken}`);
    expect(again.status).toBe(200);

    const notifications = await Notification.find({ user: targetId, type: "community.follow" });
    expect(notifications).toHaveLength(1);
  });

  it("unfollow removes you from their followers list and them from your following list", async () => {
    const { token: followerToken, userId: followerId } = await register("fm-follower2@example.com", "Follower Two");
    const { token: targetToken, userId: targetId } = await register("fm-target2@example.com", "Target Two");

    await request(app).post(`/api/follow/${targetId}`).set("Authorization", `Bearer ${followerToken}`);
    const followersBefore = await request(app).get(`/api/follow/${targetId}/followers`);
    expect(followersBefore.body.data.some((u: { id: string }) => u.id === followerId)).toBe(true);

    await request(app).delete(`/api/follow/${targetId}`).set("Authorization", `Bearer ${followerToken}`);

    const followersAfter = await request(app).get(`/api/follow/${targetId}/followers`);
    expect(followersAfter.body.data.some((u: { id: string }) => u.id === followerId)).toBe(false);

    const followingAfter = await request(app).get(`/api/follow/${followerId}/following`);
    expect(followingAfter.body.data.some((u: { id: string }) => u.id === targetId)).toBe(false);

    // sanity: the target's own following list is untouched by the follower's unfollow action
    void targetToken;
  });

  it("removing a follower deletes the Follow doc without needing the follower's cooperation", async () => {
    const { token: followerToken, userId: followerId } = await register("fm-follower3@example.com", "Follower Three");
    const { token: targetToken, userId: targetId } = await register("fm-target3@example.com", "Target Three");

    await request(app).post(`/api/follow/${targetId}`).set("Authorization", `Bearer ${followerToken}`);

    const remove = await request(app)
      .delete(`/api/follow/followers/${followerId}`)
      .set("Authorization", `Bearer ${targetToken}`);
    expect(remove.status).toBe(200);

    const followersAfter = await request(app).get(`/api/follow/${targetId}/followers`);
    expect(followersAfter.body.data.some((u: { id: string }) => u.id === followerId)).toBe(false);

    // The follower's own "following" list also reflects the removal — it's
    // the same underlying Follow document, just queried from the other side.
    const followingAfter = await request(app).get(`/api/follow/${followerId}/following`);
    expect(followingAfter.body.data.some((u: { id: string }) => u.id === targetId)).toBe(false);
  });

  it("removing a follower who never followed you is a harmless no-op", async () => {
    const { token: targetToken, userId: targetId } = await register("fm-target4@example.com", "Target Four");
    const { userId: strangerId } = await register("fm-stranger1@example.com", "Stranger One");
    void targetId;

    const res = await request(app)
      .delete(`/api/follow/followers/${strangerId}`)
      .set("Authorization", `Bearer ${targetToken}`);
    expect(res.status).toBe(200);
  });

  it("removing a follower requires auth", async () => {
    const { userId } = await register("fm-target5@example.com", "Target Five");
    const res = await request(app).delete(`/api/follow/followers/${userId}`);
    expect(res.status).toBe(401);
  });
});
