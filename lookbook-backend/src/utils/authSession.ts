import type { Request, Response } from "express";
import { RefreshToken } from "../models/RefreshToken";
import type { IUser } from "../models/User";
import { env } from "../config/env";
import { generateAccessToken, generateRefreshTokenValue, hashToken } from "./generateToken";
import { generateCsrfToken } from "./csrf";

const DAY_MS = 24 * 60 * 60 * 1000;

const refreshCookieOptions = (maxAgeMs: number) => ({
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.isProd ? ("none" as const) : ("lax" as const),
  maxAge: maxAgeMs,
  path: "/api/auth",
});

// Deliberately NOT httpOnly — the frontend reads this value via
// document.cookie and echoes it back as a header for the double-submit CSRF
// check (see middleware/csrf.ts). Path MUST be "/" here, unlike the refresh
// cookie: document.cookie visibility is scoped to the *current page's* path,
// and every frontend route lives under "/", never under "/api/auth" — a
// path of "/api/auth" would make the cookie unreadable from every single
// page in the SPA, silently breaking every refresh/logout call. The cookie
// is still only ever *sent* to /api/auth/* by the browser regardless, since
// that's governed by the request's path, not the reading page's path.
const csrfCookieOptions = (maxAgeMs: number) => ({
  httpOnly: false,
  secure: env.isProd,
  sameSite: env.isProd ? ("none" as const) : ("lax" as const),
  maxAge: maxAgeMs,
  path: "/",
});

/** Issues a fresh access + refresh token pair for a user and sets the refresh cookie. */
export const issueSession = async (
  req: Request,
  res: Response,
  user: IUser,
  rememberMe = true
) => {
  const accessToken = generateAccessToken({ id: user.id, role: user.role });

  const refreshValue = generateRefreshTokenValue();
  const days = rememberMe ? env.refreshTokenRememberMeExpiresInDays : env.refreshTokenSessionExpiresInDays;
  const expiresAt = new Date(Date.now() + days * DAY_MS);

  await RefreshToken.create({
    user: user.id,
    tokenHash: hashToken(refreshValue),
    userAgent: req.headers["user-agent"],
    ip: req.ip,
    rememberMe,
    expiresAt,
  });

  res.cookie(env.refreshCookieName, refreshValue, refreshCookieOptions(days * DAY_MS));
  res.cookie(env.csrfCookieName, generateCsrfToken(), csrfCookieOptions(days * DAY_MS));

  return accessToken;
};

/** Revokes the refresh token carried in the request cookie, if any, and clears the cookie. */
export const clearSession = async (req: Request, res: Response) => {
  const raw = req.cookies?.[env.refreshCookieName];
  if (raw) {
    await RefreshToken.updateOne({ tokenHash: hashToken(raw) }, { revoked: true });
  }
  res.clearCookie(env.refreshCookieName, { path: "/api/auth" });
  res.clearCookie(env.csrfCookieName, { path: "/" });
};
