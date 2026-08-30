import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { csrfTokensMatch } from "../utils/csrf";
import { env } from "../config/env";

/**
 * Double-submit-cookie check for the two state-changing endpoints that
 * authenticate purely off the httpOnly refresh cookie (no Bearer header):
 * /auth/refresh and /auth/logout. Everything else in the app requires an
 * Authorization header, which a cross-site page can't forge, so this
 * middleware is deliberately scoped to just those two routes rather than
 * applied blanket-wide.
 */
export const verifyCsrf = (req: Request, _res: Response, next: NextFunction) => {
  const cookieToken = req.cookies?.[env.csrfCookieName];
  const headerToken = req.headers["x-csrf-token"];

  // No CSRF cookie at all = no session was ever issued (guest), so this is an
  // auth problem, not a forgery attempt.
  if (typeof cookieToken !== "string") {
    throw ApiError.unauthorized("No active session.");
  }

  if (typeof headerToken !== "string" || !csrfTokensMatch(cookieToken, headerToken)) {
    throw ApiError.forbidden("Missing or invalid CSRF token.");
  }

  next();
};
