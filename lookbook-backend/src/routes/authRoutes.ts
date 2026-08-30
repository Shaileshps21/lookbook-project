import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  register,
  login,
  logout,
  getMe,
  refresh,
  forgotPassword,
  resetPassword,
  changePassword,
  verifyEmail,
  resendVerification,
  listSessions,
  revokeSession,
} from "../controllers/authController";
import { googleStart, googleCallback, githubStart, githubCallback } from "../controllers/oauthController";
import { setupTwoFactor, confirmTwoFactor, disableTwoFactor, verifyTwoFactorLogin } from "../controllers/twoFactorController";
import { validate } from "../middleware/validate";
import { protect } from "../middleware/auth";
import { verifyCsrf } from "../middleware/csrf";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "../validators/authValidators";
import { env } from "../config/env";

const router = Router();

const authLimiter = rateLimit({
  windowMs: env.authRateLimitWindowMs,
  max: env.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts. Please try again later." },
});

router.post("/register", authLimiter, validate(registerSchema), register);
router.post("/login", authLimiter, validate(loginSchema), login);
router.post("/refresh", verifyCsrf, refresh);
router.post("/logout", verifyCsrf, logout);
router.get("/me", protect, getMe);

router.post("/forgot-password", authLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", authLimiter, validate(resetPasswordSchema), resetPassword);
router.patch("/change-password", protect, validate(changePasswordSchema), changePassword);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", protect, authLimiter, resendVerification);

router.get("/sessions", protect, listSessions);
router.delete("/sessions/:id", protect, revokeSession);

router.post("/2fa/setup", protect, setupTwoFactor);
router.post("/2fa/confirm", protect, confirmTwoFactor);
router.post("/2fa/disable", protect, disableTwoFactor);
router.post("/2fa/login", authLimiter, verifyTwoFactorLogin);

router.get("/google", googleStart);
router.get("/google/callback", googleCallback);
router.get("/github", githubStart);
router.get("/github/callback", githubCallback);

export default router;
