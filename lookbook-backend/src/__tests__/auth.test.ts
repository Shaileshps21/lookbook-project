import request from "supertest";
import { createApp } from "../app";
import { RefreshToken } from "../models/RefreshToken";

const app = createApp();

describe("Auth", () => {
  const credentials = { name: "Test User", email: "jest@example.com", password: "TestPass@123" };

  it("registers a new account and returns an access token", async () => {
    const res = await request(app).post("/api/auth/register").send(credentials);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user.email).toBe(credentials.email);
    expect(res.body.data.user.password).toBeUndefined();
  });

  it("rejects registering the same email twice", async () => {
    await request(app).post("/api/auth/register").send(credentials);
    const res = await request(app).post("/api/auth/register").send(credentials);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it("logs in with correct credentials and rejects incorrect ones", async () => {
    await request(app).post("/api/auth/register").send(credentials);

    const good = await request(app)
      .post("/api/auth/login")
      .send({ email: credentials.email, password: credentials.password });
    expect(good.status).toBe(200);
    expect(good.body.data.accessToken).toEqual(expect.any(String));

    const bad = await request(app)
      .post("/api/auth/login")
      .send({ email: credentials.email, password: "WrongPass@123" });
    expect(bad.status).toBe(401);
  });

  it("refreshes the access token using the httpOnly refresh cookie", async () => {
    const login = await request(app).post("/api/auth/register").send(credentials);
    const cookies = login.headers["set-cookie"] as unknown as string[];
    expect(cookies).toBeDefined();

    // The refresh cookie is httpOnly, but the CSRF cookie deliberately isn't
    // — the real frontend reads it via document.cookie and echoes it back as
    // a header (double-submit check), which this reproduces manually.
    const csrfCookie = cookies.find((c) => c.startsWith("lookbook_csrf="));
    const csrfToken = csrfCookie?.split(";")[0].split("=")[1];
    expect(csrfToken).toBeDefined();

    const refreshed = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookies)
      .set("X-CSRF-Token", csrfToken as string);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.accessToken).toEqual(expect.any(String));
  });

  it("rejects a refresh attempt with a missing or mismatched CSRF token", async () => {
    const login = await request(app).post("/api/auth/register").send(credentials);
    const cookies = login.headers["set-cookie"] as unknown as string[];

    const noHeader = await request(app).post("/api/auth/refresh").set("Cookie", cookies);
    expect(noHeader.status).toBe(403);

    const wrongHeader = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookies)
      .set("X-CSRF-Token", "not-the-right-token");
    expect(wrongHeader.status).toBe(403);
  });

  it("blocks protected routes without a token", async () => {
    const res = await request(app).get("/api/wishlist");
    expect(res.status).toBe(401);
  });

  it("issues a short-lived refresh token when rememberMe is false", async () => {
    await request(app).post("/api/auth/register").send(credentials);

    const rememberedLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: credentials.email, password: credentials.password, rememberMe: true });
    expect(rememberedLogin.status).toBe(200);

    const shortLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: credentials.email, password: credentials.password, rememberMe: false });
    expect(shortLogin.status).toBe(200);

    const tokens = await RefreshToken.find({ user: shortLogin.body.data.user.id }).sort("createdAt");
    const [rememberedToken, shortToken] = tokens.slice(-2);
    expect(rememberedToken.rememberMe).toBe(true);
    expect(shortToken.rememberMe).toBe(false);
    expect(shortToken.expiresAt.getTime()).toBeLessThan(rememberedToken.expiresAt.getTime());
  });
});
