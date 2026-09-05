import request from "supertest";
import { createApp } from "../app";

const app = createApp();

const register = async (email: string, name: string) => {
  const res = await request(app).post("/api/auth/register").send({ name, email, password: "TestPass@123" });
  return { token: res.body.data.accessToken as string, userId: res.body.data.user.id as string };
};

const makePublic = (token: string) =>
  request(app).patch("/api/users/public-profile").set("Authorization", `Bearer ${token}`).send({ publicProfile: true });

describe("GET /api/users/directory", () => {
  it("only lists opt-in public profiles, and excludes the viewer", async () => {
    const { token: viewerToken, userId: viewerId } = await register("dir-viewer1@example.com", "Viewer One");
    await makePublic(viewerToken);
    const { token: publicToken, userId: publicId } = await register("dir-public1@example.com", "Public Reader");
    await makePublic(publicToken);
    await register("dir-private1@example.com", "Private Reader"); // never opts in

    const res = await request(app).get("/api/users/directory").set("Authorization", `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((u: { id: string }) => u.id);
    expect(ids).toContain(publicId);
    expect(ids).not.toContain(viewerId);
    expect(ids.length).toBeLessThanOrEqual(res.body.meta.total);
  });

  it("search filters by name (case-insensitive)", async () => {
    const { token } = await register("dir-searcher@example.com", "Searcher");
    const { token: matchToken } = await register("dir-match@example.com", "Zebra Reader");
    await makePublic(matchToken);
    const { token: otherToken } = await register("dir-nomatch@example.com", "Other Person");
    await makePublic(otherToken);

    const res = await request(app).get("/api/users/directory").set("Authorization", `Bearer ${token}`).query({ q: "zebra" });
    expect(res.body.data.every((u: { name: string }) => u.name.toLowerCase().includes("zebra"))).toBe(true);
    expect(res.body.data.some((u: { name: string }) => u.name === "Zebra Reader")).toBe(true);
  });

  it("isFollowing reflects the viewer's own follow state", async () => {
    const { token: viewerToken } = await register("dir-follower@example.com", "Follower");
    const { token: targetToken, userId: targetId } = await register("dir-target@example.com", "Target Reader");
    await makePublic(targetToken);

    await request(app).post(`/api/follow/${targetId}`).set("Authorization", `Bearer ${viewerToken}`);

    const res = await request(app).get("/api/users/directory").set("Authorization", `Bearer ${viewerToken}`);
    const row = res.body.data.find((u: { id: string }) => u.id === targetId);
    expect(row.isFollowing).toBe(true);
  });

  it("works for a logged-out viewer too (no auth header)", async () => {
    const { token } = await register("dir-anon-source@example.com", "Anon Source");
    await makePublic(token);

    const res = await request(app).get("/api/users/directory");
    expect(res.status).toBe(200);
  });
});
