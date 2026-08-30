import request from "supertest";
import { authenticator } from "otplib";
import { createApp } from "../app";

const app = createApp();

const registerAndGetToken = async (email: string): Promise<string> => {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name: "2FA Tester", email, password: "TestPass@123" });
  return res.body.data.accessToken as string;
};

describe("Two-factor authentication", () => {
  it("completes the full setup -> confirm -> login-challenge cycle", async () => {
    const token = await registerAndGetToken("2fa1@example.com");

    const setup = await request(app).post("/api/auth/2fa/setup").set("Authorization", `Bearer ${token}`);
    expect(setup.status).toBe(200);
    const { secret } = setup.body.data;
    expect(secret).toEqual(expect.any(String));

    const code = authenticator.generate(secret);
    const confirm = await request(app)
      .post("/api/auth/2fa/confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({ token: code });
    expect(confirm.status).toBe(200);
    expect(confirm.body.data.twoFactorEnabled).toBe(true);

    // A normal login attempt should no longer issue a session directly...
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "2fa1@example.com", password: "TestPass@123" });
    expect(login.status).toBe(200);
    expect(login.body.data.requiresTwoFactor).toBe(true);
    expect(login.body.data.challengeToken).toEqual(expect.any(String));

    // ...it needs the second step with a fresh TOTP code.
    const loginCode = authenticator.generate(secret);
    const verify = await request(app)
      .post("/api/auth/2fa/login")
      .send({ challengeToken: login.body.data.challengeToken, token: loginCode });
    expect(verify.status).toBe(200);
    expect(verify.body.data.accessToken).toEqual(expect.any(String));
  });

  it("rejects an incorrect code at the confirm step", async () => {
    const token = await registerAndGetToken("2fa2@example.com");
    await request(app).post("/api/auth/2fa/setup").set("Authorization", `Bearer ${token}`);

    const confirm = await request(app)
      .post("/api/auth/2fa/confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({ token: "000000" });
    expect(confirm.status).toBe(400);
  });

  it("can disable 2FA with a valid code", async () => {
    const token = await registerAndGetToken("2fa3@example.com");
    const setup = await request(app).post("/api/auth/2fa/setup").set("Authorization", `Bearer ${token}`);
    const { secret } = setup.body.data;
    await request(app)
      .post("/api/auth/2fa/confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({ token: authenticator.generate(secret) });

    const disable = await request(app)
      .post("/api/auth/2fa/disable")
      .set("Authorization", `Bearer ${token}`)
      .send({ token: authenticator.generate(secret) });
    expect(disable.status).toBe(200);
    expect(disable.body.data.twoFactorEnabled).toBe(false);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "2fa3@example.com", password: "TestPass@123" });
    expect(login.body.data.requiresTwoFactor).toBeUndefined();
    expect(login.body.data.accessToken).toEqual(expect.any(String));
  });
});
