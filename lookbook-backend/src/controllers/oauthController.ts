import crypto from "crypto";
import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { issueSession } from "../utils/authSession";
import { User } from "../models/User";
import { env } from "../config/env";

const STATE_COOKIE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

const stateCookieOptions = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: "lax" as const,
  maxAge: STATE_COOKIE_MAX_AGE_MS,
  path: "/api/auth",
};

const startOAuth = (authorizeUrl: string, res: Response) => {
  const state = crypto.randomBytes(24).toString("hex");
  res.cookie(env.oauthStateCookieName, state, stateCookieOptions);
  const url = new URL(authorizeUrl);
  url.searchParams.set("state", state);
  res.redirect(url.toString());
};

const verifyState = (req: Request, res: Response) => {
  const cookieState = req.cookies?.[env.oauthStateCookieName];
  const queryState = req.query.state as string | undefined;
  res.clearCookie(env.oauthStateCookieName, { path: "/api/auth" });

  if (!cookieState || !queryState || cookieState !== queryState) {
    throw ApiError.badRequest("Invalid OAuth state. Please try signing in again.");
  }
};

/** Finds an existing user by provider id or email, or creates a new one. */
const findOrCreateOAuthUser = async (params: {
  providerField: "googleId" | "githubId";
  providerId: string;
  name: string;
  email: string;
  avatar?: string;
}) => {
  const { providerField, providerId, name, email, avatar } = params;

  let user = await User.findOne({ [providerField]: providerId });
  if (user) return user;

  user = await User.findOne({ email });
  if (user) {
    user.set(providerField, providerId);
    if (!user.avatar && avatar) user.avatar = avatar;
    await user.save();
    return user;
  }

  return User.create({
    name,
    email,
    avatar,
    emailVerified: true,
    [providerField]: providerId,
  });
};

const redirectToFrontend = (res: Response) => {
  res.redirect(`${env.clientUrl}/oauth/callback`);
};

export const googleStart = (_req: Request, res: Response) => {
  if (!env.google.clientId) {
    throw ApiError.badRequest("Google sign-in is not configured.");
  }
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.google.clientId);
  url.searchParams.set("redirect_uri", env.google.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("prompt", "select_account");
  startOAuth(url.toString(), res);
};

export const googleCallback = asyncHandler(async (req: Request, res: Response) => {
  verifyState(req, res);

  const code = req.query.code as string | undefined;
  if (!code) throw ApiError.badRequest("Missing authorization code from Google.");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.google.clientId,
      client_secret: env.google.clientSecret,
      code,
      redirect_uri: env.google.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) throw ApiError.badRequest("Could not verify Google sign-in.");
  const { access_token: googleAccessToken } = (await tokenRes.json()) as { access_token: string };

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${googleAccessToken}` },
  });
  if (!profileRes.ok) throw ApiError.badRequest("Could not fetch Google profile.");
  const profile = (await profileRes.json()) as {
    sub: string;
    email: string;
    name: string;
    picture?: string;
  };

  const user = await findOrCreateOAuthUser({
    providerField: "googleId",
    providerId: profile.sub,
    name: profile.name,
    email: profile.email,
    avatar: profile.picture,
  });

  await issueSession(req, res, user, true);
  redirectToFrontend(res);
});

export const githubStart = (_req: Request, res: Response) => {
  if (!env.github.clientId) {
    throw ApiError.badRequest("GitHub sign-in is not configured.");
  }
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", env.github.clientId);
  url.searchParams.set("redirect_uri", env.github.redirectUri);
  url.searchParams.set("scope", "read:user user:email");
  startOAuth(url.toString(), res);
};

export const githubCallback = asyncHandler(async (req: Request, res: Response) => {
  verifyState(req, res);

  const code = req.query.code as string | undefined;
  if (!code) throw ApiError.badRequest("Missing authorization code from GitHub.");

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env.github.clientId,
      client_secret: env.github.clientSecret,
      code,
      redirect_uri: env.github.redirectUri,
    }),
  });
  if (!tokenRes.ok) throw ApiError.badRequest("Could not verify GitHub sign-in.");
  const tokenBody = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenBody.access_token) throw ApiError.badRequest("Could not verify GitHub sign-in.");

  const headers = {
    Authorization: `Bearer ${tokenBody.access_token}`,
    Accept: "application/vnd.github+json",
  };

  const profileRes = await fetch("https://api.github.com/user", { headers });
  if (!profileRes.ok) throw ApiError.badRequest("Could not fetch GitHub profile.");
  const profile = (await profileRes.json()) as {
    id: number;
    name: string | null;
    login: string;
    avatar_url?: string;
    email: string | null;
  };

  let email = profile.email;
  if (!email) {
    const emailsRes = await fetch("https://api.github.com/user/emails", { headers });
    if (emailsRes.ok) {
      const emails = (await emailsRes.json()) as { email: string; primary: boolean; verified: boolean }[];
      email = emails.find((e) => e.primary && e.verified)?.email ?? emails.find((e) => e.verified)?.email ?? null;
    }
  }
  if (!email) {
    throw ApiError.badRequest("Your GitHub account has no verified email address to sign in with.");
  }

  const user = await findOrCreateOAuthUser({
    providerField: "githubId",
    providerId: String(profile.id),
    name: profile.name ?? profile.login,
    email,
    avatar: profile.avatar_url,
  });

  await issueSession(req, res, user, true);
  redirectToFrontend(res);
});
