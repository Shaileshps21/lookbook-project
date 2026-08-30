import type { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { verifyAccessToken } from "../utils/generateToken";
import { User } from "../models/User";

const extractToken = (req: Request): string | undefined => {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return header.split(" ")[1];
  }
  return undefined;
};

export const protect = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = extractToken(req);

  if (!token) {
    throw ApiError.unauthorized("Not authenticated. Please log in.");
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized("Session expired or invalid. Please log in again.");
  }

  const user = await User.findById(payload.id);
  if (!user) {
    throw ApiError.unauthorized("User belonging to this token no longer exists.");
  }
  if (user.suspended) {
    throw ApiError.forbidden(user.suspendedReason ? `Account suspended: ${user.suspendedReason}` : "Account suspended.");
  }

  req.user = user;
  next();
});

/** Attaches req.user if a valid token is present, but never blocks the request. */
export const attachUserIfPresent = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const token = extractToken(req);
    if (!token) return next();

    try {
      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.id);
      if (user) req.user = user;
    } catch {
      // ignore invalid/expired tokens for optional auth routes
    }
    next();
  }
);

export const adminOnly = (req: Request, _res: Response, next: NextFunction) => {
  if (req.user?.role !== "admin") {
    throw ApiError.forbidden("This action requires admin privileges.");
  }
  next();
};

export const sellerOnly = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user?.isSeller && req.user?.role !== "admin") {
    throw ApiError.forbidden("This action requires an approved seller account.");
  }
  next();
};

/** Gates checkout on a verified email — someone who never confirmed they
 * own their inbox shouldn't be able to place a real, paid order (no
 * legitimate way to reach them for delivery/order issues, and it's the
 * cheapest lever against throwaway-account abuse). OAuth accounts are
 * always emailVerified: true at creation, so this never blocks them. */
export const requireVerifiedEmail = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user?.emailVerified) {
    throw ApiError.forbidden("Please verify your email address before placing an order or listing books.");
  }
  next();
};
