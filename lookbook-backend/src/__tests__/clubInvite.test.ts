import request from "supertest";
import { createApp } from "../app";
import { env } from "../config/env";

const app = createApp();

const registerAndGetToken = async (email: string) => {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name: "Club Tester", email, password: "TestPass@123" });
  return { token: res.body.data.accessToken as string, userId: res.body.data.user.id as string };
};

describe("Club invite links", () => {
  it("auto-generates a unique invite token on club creation", async () => {
    const { token } = await registerAndGetToken("clubowner1@example.com");

    const clubA = await request(app)
      .post("/api/clubs")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Club A" });
    const clubB = await request(app)
      .post("/api/clubs")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Club B" });

    expect(clubA.body.data.inviteToken).toBeDefined();
    expect(clubB.body.data.inviteToken).toBeDefined();
    expect(clubA.body.data.inviteToken).not.toBe(clubB.body.data.inviteToken);
  });

  it("builds inviteUrl from the server-configured CLIENT_URL, never a request-supplied origin", async () => {
    const { token } = await registerAndGetToken("clubowner6@example.com");

    const created = await request(app)
      .post("/api/clubs")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "URL Club" });

    expect(created.body.data.inviteUrl).toBe(`${env.clientUrl}/clubs/join/${created.body.data.inviteToken}`);

    const fetched = await request(app)
      .get(`/api/clubs/${created.body.data.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(fetched.body.data.inviteUrl).toBe(created.body.data.inviteUrl);
  });

  it("any current member (not just the owner) can see the club — the invite link is not owner-restricted at the API level", async () => {
    const { token: ownerToken } = await registerAndGetToken("clubowner7@example.com");
    const { token: memberToken } = await registerAndGetToken("member2@example.com");

    const created = await request(app)
      .post("/api/clubs")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Shared Invite Club" });
    const clubId = created.body.data.id as string;
    const inviteToken = created.body.data.inviteToken as string;

    await request(app).post(`/api/clubs/invite/${inviteToken}/join`).set("Authorization", `Bearer ${memberToken}`);

    const memberView = await request(app).get(`/api/clubs/${clubId}`).set("Authorization", `Bearer ${memberToken}`);
    expect(memberView.status).toBe(200);
    expect(memberView.body.data.inviteUrl).toBe(created.body.data.inviteUrl);
  });

  it("returns the join preview by token, and the join flow end-to-end", async () => {
    const { token: ownerToken } = await registerAndGetToken("clubowner2@example.com");
    const { token: joinerToken, userId: joinerId } = await registerAndGetToken("joiner1@example.com");

    const created = await request(app)
      .post("/api/clubs")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Readers Circle", description: "We read things" });
    const inviteToken = created.body.data.inviteToken as string;

    const preview = await request(app).get(`/api/clubs/invite/${inviteToken}`);
    expect(preview.status).toBe(200);
    expect(preview.body.data).toMatchObject({ name: "Readers Circle", memberCount: 1 });

    const join = await request(app)
      .post(`/api/clubs/invite/${inviteToken}/join`)
      .set("Authorization", `Bearer ${joinerToken}`);
    expect(join.status).toBe(200);
    expect(join.body.data.alreadyMember).toBe(false);
    expect(join.body.data.club.members.some((m: { id: string }) => m.id === joinerId)).toBe(true);

    const joinAgain = await request(app)
      .post(`/api/clubs/invite/${inviteToken}/join`)
      .set("Authorization", `Bearer ${joinerToken}`);
    expect(joinAgain.status).toBe(200);
    expect(joinAgain.body.data.alreadyMember).toBe(true);
  });

  it("returns 404 for an unknown token and for a disabled invite link", async () => {
    const { token: ownerToken } = await registerAndGetToken("clubowner3@example.com");

    const unknown = await request(app).get("/api/clubs/invite/does-not-exist");
    expect(unknown.status).toBe(404);

    const created = await request(app)
      .post("/api/clubs")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Disable Me" });
    const clubId = created.body.data.id as string;
    const inviteToken = created.body.data.inviteToken as string;

    const disable = await request(app)
      .patch(`/api/clubs/${clubId}/invite-enabled`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ enabled: false });
    expect(disable.status).toBe(200);
    expect(disable.body.data.inviteEnabled).toBe(false);

    const disabledPreview = await request(app).get(`/api/clubs/invite/${inviteToken}`);
    expect(disabledPreview.status).toBe(404);
  });

  it("regenerating the invite link invalidates the old token", async () => {
    const { token: ownerToken } = await registerAndGetToken("clubowner4@example.com");

    const created = await request(app)
      .post("/api/clubs")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Regen Club" });
    const clubId = created.body.data.id as string;
    const oldToken = created.body.data.inviteToken as string;

    const regen = await request(app)
      .post(`/api/clubs/${clubId}/regenerate-invite`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(regen.status).toBe(200);
    const newToken = regen.body.data.inviteToken as string;
    expect(newToken).not.toBe(oldToken);

    const oldLookup = await request(app).get(`/api/clubs/invite/${oldToken}`);
    expect(oldLookup.status).toBe(404);

    const newLookup = await request(app).get(`/api/clubs/invite/${newToken}`);
    expect(newLookup.status).toBe(200);
  });

  it("only the owner (not an arbitrary member) can regenerate or toggle the invite link", async () => {
    const { token: ownerToken } = await registerAndGetToken("clubowner5@example.com");
    const { token: memberToken } = await registerAndGetToken("member1@example.com");

    const created = await request(app)
      .post("/api/clubs")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Owner Only Club" });
    const clubId = created.body.data.id as string;

    const forbiddenRegen = await request(app)
      .post(`/api/clubs/${clubId}/regenerate-invite`)
      .set("Authorization", `Bearer ${memberToken}`);
    expect(forbiddenRegen.status).toBe(403);

    const forbiddenToggle = await request(app)
      .patch(`/api/clubs/${clubId}/invite-enabled`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ enabled: false });
    expect(forbiddenToggle.status).toBe(403);
  });
});
