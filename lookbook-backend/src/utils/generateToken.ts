import jwt, { type SignOptions } from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env";

export interface TokenPayload {
  id: string;
  role: "user" | "admin";
  purpose: "access";
}

export const generateAccessToken = (payload: Omit<TokenPayload, "purpose">): string => {
  const options: SignOptions = { expiresIn: env.accessTokenExpiresIn as SignOptions["expiresIn"] };
  return jwt.sign({ ...payload, purpose: "access" }, env.jwtSecret, options);
};

// Explicitly checks `purpose` rather than just verifying the signature — a
// 2FA challenge token (see below) is signed with the same secret, and
// without this check it would decode successfully here too, letting a
// leaked/intercepted challenge token bypass the second factor entirely by
// using it directly as a Bearer access token.
export const verifyAccessToken = (token: string): TokenPayload => {
  const payload = jwt.verify(token, env.jwtSecret) as TokenPayload;
  if (payload.purpose !== "access") throw new Error("Not an access token.");
  return payload;
};

export interface TwoFactorChallengePayload {
  id: string;
  purpose: "2fa-challenge";
}

/** Short-lived — just long enough for the user to open their authenticator
 * app and type the 6-digit code, nothing else can be done with this token. */
export const generateTwoFactorChallengeToken = (id: string): string =>
  jwt.sign({ id, purpose: "2fa-challenge" }, env.jwtSecret, { expiresIn: "5m" });

export const verifyTwoFactorChallengeToken = (token: string): TwoFactorChallengePayload => {
  const payload = jwt.verify(token, env.jwtSecret) as TwoFactorChallengePayload;
  if (payload.purpose !== "2fa-challenge") throw new Error("Not a 2FA challenge token.");
  return payload;
};

// The refresh token itself is an opaque random string (not a JWT) so that
// revoking it server-side is a simple hash lookup, not JWT-blacklist gymnastics.
export const generateRefreshTokenValue = (): string => crypto.randomBytes(48).toString("hex");

export const hashToken = (value: string): string =>
  crypto.createHash("sha256").update(value).digest("hex");
