import type { Request, Response } from "express";
import { authenticator } from "otplib";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { User } from "../models/User";
import { sanitizeUser } from "../utils/sanitizeUser";
import { issueSession } from "../utils/authSession";
import { verifyTwoFactorChallengeToken } from "../utils/generateToken";

/** Step 1 of enabling 2FA: generate a secret, stash it as "pending" until the
 * user proves they've actually added it to an authenticator app (§9.4). */
export const setupTwoFactor = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const secret = authenticator.generateSecret();
  req.user.twoFactorTempSecret = secret;
  await req.user.save();

  const otpauthUrl = authenticator.keyuri(req.user.email, "LookBook", secret);
  return ApiResponse.ok(res, { secret, otpauthUrl });
});

/** Step 2: confirm setup by verifying one real code from the app. */
export const confirmTwoFactor = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const user = await User.findById(req.user.id).select("+twoFactorTempSecret");
  if (!user?.twoFactorTempSecret) throw ApiError.badRequest("No 2FA setup in progress. Start setup first.");

  const { token } = req.body as { token: string };
  if (!authenticator.verify({ token, secret: user.twoFactorTempSecret })) {
    throw ApiError.badRequest("Invalid code. Check your authenticator app and try again.");
  }

  user.twoFactorSecret = user.twoFactorTempSecret;
  user.twoFactorTempSecret = undefined;
  user.twoFactorEnabled = true;
  await user.save();

  return ApiResponse.ok(res, { twoFactorEnabled: true }, "Two-factor authentication enabled");
});

export const disableTwoFactor = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const user = await User.findById(req.user.id).select("+twoFactorSecret");
  if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
    throw ApiError.badRequest("Two-factor authentication isn't enabled.");
  }

  const { token } = req.body as { token: string };
  if (!authenticator.verify({ token, secret: user.twoFactorSecret })) {
    throw ApiError.badRequest("Invalid code.");
  }

  user.twoFactorEnabled = false;
  user.twoFactorSecret = undefined;
  await user.save();

  return ApiResponse.ok(res, { twoFactorEnabled: false }, "Two-factor authentication disabled");
});

/** Step 2 of login when 2FA is enabled — exchanges the short-lived challenge
 * token (issued by authController.login instead of a real session) plus a
 * TOTP code for the actual session. */
export const verifyTwoFactorLogin = asyncHandler(async (req: Request, res: Response) => {
  const { challengeToken, token } = req.body as { challengeToken: string; token: string };
  if (!challengeToken || !token) throw ApiError.badRequest("challengeToken and token are required.");

  let payload;
  try {
    payload = verifyTwoFactorChallengeToken(challengeToken);
  } catch {
    throw ApiError.unauthorized("This login attempt has expired. Please log in again.");
  }

  const user = await User.findById(payload.id).select("+twoFactorSecret");
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    throw ApiError.unauthorized("Two-factor authentication is not active on this account.");
  }
  if (user.suspended) {
    throw ApiError.forbidden(user.suspendedReason ? `Account suspended: ${user.suspendedReason}` : "Account suspended.");
  }

  if (!authenticator.verify({ token, secret: user.twoFactorSecret })) {
    throw ApiError.unauthorized("Invalid code.");
  }

  const accessToken = await issueSession(req, res, user, true);
  return ApiResponse.ok(res, { user: sanitizeUser(user), accessToken }, "Logged in successfully");
});
