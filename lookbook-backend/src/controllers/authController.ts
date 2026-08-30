import crypto from "crypto";
import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { hashToken, generateTwoFactorChallengeToken } from "../utils/generateToken";
import { issueSession, clearSession } from "../utils/authSession";
import { RefreshToken } from "../models/RefreshToken";
import { User } from "../models/User";
import { env } from "../config/env";
import { sendMail, buildVerifyEmailHtml, buildResetPasswordHtml } from "../utils/mailer";
import { sanitizeUser } from "../utils/sanitizeUser";
import type {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ChangePasswordInput,
} from "../validators/authValidators";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const sendVerificationEmail = async (user: { id: string; email: string; name: string }) => {
  const rawToken = crypto.randomBytes(32).toString("hex");
  await User.findByIdAndUpdate(user.id, {
    emailVerificationTokenHash: hashToken(rawToken),
    emailVerificationExpires: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
  });
  const link = `${env.clientUrl}/verify-email?token=${rawToken}`;
  await sendMail({
    to: user.email,
    subject: "Verify your LookBook email",
    html: buildVerifyEmailHtml(link),
  });
};

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password } = req.body as RegisterInput;

  const existing = await User.findOne({ email });
  if (existing) {
    throw ApiError.conflict("An account with this email already exists.");
  }

  // In development there's no guarantee the verification email can be delivered
  // (SMTP may be unconfigured), so auto-verify so checkout and other
  // email-gated flows actually work. Production keeps the real verification.
  const emailVerified = !env.isProd;

  const user = await User.create({ name, email, password, emailVerified });
  const accessToken = await issueSession(req, res, user, true);

  if (!emailVerified) {
    sendVerificationEmail({ id: user.id, email: user.email, name: user.name }).catch(() => {
      // Best-effort — registration should not fail just because the email couldn't be sent.
    });
  }

  return ApiResponse.created(
    res,
    { user: sanitizeUser(user), accessToken },
    "Account created successfully"
  );
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, rememberMe } = req.body as LoginInput;

  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized("Invalid email or password.");
  }
  if (user.suspended) {
    throw ApiError.forbidden(user.suspendedReason ? `Account suspended: ${user.suspendedReason}` : "Account suspended.");
  }

  // Password alone isn't enough for a 2FA-enabled account — hand back a
  // short-lived challenge token instead of a real session; the frontend
  // exchanges it for one at /auth/2fa/login once the user enters a code.
  if (user.twoFactorEnabled) {
    return ApiResponse.ok(
      res,
      { requiresTwoFactor: true, challengeToken: generateTwoFactorChallengeToken(user.id) },
      "Two-factor authentication code required"
    );
  }

  const accessToken = await issueSession(req, res, user, rememberMe ?? true);

  return ApiResponse.ok(res, { user: sanitizeUser(user), accessToken }, "Logged in successfully");
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const raw = req.cookies?.[env.refreshCookieName];
  if (!raw) throw ApiError.unauthorized("No active session.");

  const tokenHash = hashToken(raw);

  // Atomic find-and-revoke: only the first of any concurrent requests
  // bearing this token can win. This is what makes rotation actually detect
  // reuse/theft — without the atomic filter, two simultaneous requests could
  // both read the token as valid before either write lands, and both would
  // succeed instead of the second being rejected.
  const stored = await RefreshToken.findOneAndUpdate(
    { tokenHash, revoked: false, expiresAt: { $gt: new Date() } },
    { revoked: true }
  );

  if (!stored) {
    // Reuse of an already-rotated/expired token is a signal of possible
    // theft — clear the cookie so the client is forced through a clean login.
    await clearSession(req, res);
    throw ApiError.unauthorized("Session expired or invalid. Please log in again.");
  }

  const user = await User.findById(stored.user);
  if (!user) {
    await clearSession(req, res);
    throw ApiError.unauthorized("User belonging to this session no longer exists.");
  }
  if (user.suspended) {
    await clearSession(req, res);
    throw ApiError.forbidden(user.suspendedReason ? `Account suspended: ${user.suspendedReason}` : "Account suspended.");
  }

  const accessToken = await issueSession(req, res, user, stored.rememberMe);

  return ApiResponse.ok(res, { user: sanitizeUser(user), accessToken }, "Session refreshed");
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await clearSession(req, res);
  return ApiResponse.ok(res, null, "Logged out successfully");
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  return ApiResponse.ok(res, { user: sanitizeUser(req.user) });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as ForgotPasswordInput;
  const user = await User.findOne({ email });

  // Always respond the same way whether or not the account exists, so this
  // endpoint can't be used to enumerate registered emails.
  if (user) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    user.passwordResetTokenHash = hashToken(rawToken);
    user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await user.save();

    const link = `${env.clientUrl}/reset-password?token=${rawToken}`;
    await sendMail({
      to: user.email,
      subject: "Reset your LookBook password",
      html: buildResetPasswordHtml(link),
    });
  }

  return ApiResponse.ok(res, null, "If that email is registered, a reset link has been sent.");
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body as ResetPasswordInput;
  const tokenHash = hashToken(token);

  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  }).select("+passwordResetTokenHash +passwordResetExpires");

  if (!user) {
    throw ApiError.badRequest("This reset link is invalid or has expired.");
  }

  user.password = password;
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // Force re-login everywhere — a compromised password shouldn't leave old
  // sessions valid.
  await RefreshToken.updateMany({ user: user.id }, { revoked: true });

  return ApiResponse.ok(res, null, "Password reset successfully. Please log in again.");
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { currentPassword, newPassword } = req.body as ChangePasswordInput;

  const user = await User.findById(req.user.id).select("+password");
  if (!user) throw ApiError.unauthorized();
  if (!(await user.comparePassword(currentPassword))) {
    throw ApiError.unauthorized("Current password is incorrect.");
  }

  user.password = newPassword;
  await user.save();

  // A changed password should invalidate every existing session, including
  // the one this request came in on — the frontend must call logout() right
  // after this succeeds rather than trying to keep using the current tab.
  await RefreshToken.updateMany({ user: user.id }, { revoked: true });

  return ApiResponse.ok(res, null, "Password changed. Please log in again.");
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.body as { token: string };
  if (!token) throw ApiError.badRequest("Verification token is required.");

  const tokenHash = hashToken(token);
  const user = await User.findOne({
    emailVerificationTokenHash: tokenHash,
    emailVerificationExpires: { $gt: new Date() },
  }).select("+emailVerificationTokenHash +emailVerificationExpires");

  if (!user) {
    throw ApiError.badRequest("This verification link is invalid or has expired.");
  }

  user.emailVerified = true;
  user.emailVerificationTokenHash = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  return ApiResponse.ok(res, null, "Email verified successfully.");
});

export const resendVerification = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  if (req.user.emailVerified) {
    return ApiResponse.ok(res, null, "Your email is already verified.");
  }

  await sendVerificationEmail({ id: req.user.id, email: req.user.email, name: req.user.name });
  return ApiResponse.ok(res, null, "Verification email sent.");
});

export const listSessions = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const currentRaw = req.cookies?.[env.refreshCookieName];
  const currentHash = currentRaw ? hashToken(currentRaw) : null;

  const sessions = await RefreshToken.find({ user: req.user.id, revoked: false })
    .sort("-lastUsedAt")
    .select("userAgent ip lastUsedAt createdAt expiresAt tokenHash");

  return ApiResponse.ok(
    res,
    sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ip: s.ip,
      lastUsedAt: s.lastUsedAt,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      current: s.tokenHash === currentHash,
    }))
  );
});

export const revokeSession = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const session = await RefreshToken.findOne({ _id: req.params.id, user: req.user.id });
  if (!session) throw ApiError.notFound("Session not found.");

  session.revoked = true;
  await session.save();

  return ApiResponse.ok(res, null, "Session revoked.");
});
