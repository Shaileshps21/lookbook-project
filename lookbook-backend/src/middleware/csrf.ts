import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { csrfTokensMatch } from "../utils/csrf";
import { env } from "../config/env";

/**
 * CSRF check for the two state-changing endpoints that authenticate purely
 * off the httpOnly refresh cookie (no Bearer header): /auth/refresh and
 * /auth/logout. Everything else in the app requires an Authorization header,
 * which a cross-site page can't forge, so this middleware is deliberately
 * scoped to just those two routes rather than applied blanket-wide.
 *
 * The frontend and API live on different origins (e.g. a Vercel domain and a
 * Render domain), so the CSRF cookie set here is never readable via
 * document.cookie from the frontend's own origin — cookie visibility is
 * strictly origin-scoped and that isn't affected by SameSite/Secure. A
 * classic double-submit-cookie check would therefore fail on every request
 * from the real frontend, not just forged ones. Instead, trust the Origin
 * header: it's set by the browser on every cross-origin fetch/XHR and can't
 * be overridden by page JavaScript, so an exact match against the
 * configured CLIENT_URL is a reliable signal the request came from the real
 * app. The cookie/header double-submit is kept as a fallback for the case
 * where frontend and backend genuinely share an origin (or a proxy makes
 * them appear to) and Origin may be same-site and thus absent.
 */
export const verifyCsrf = (req: Request, _res: Response, next: NextFunction) => {
  const cookieToken = req.cookies?.[env.csrfCookieName];

  // No CSRF cookie at all = no session was ever issued (guest), so this is an
  // auth problem, not a forgery attempt.
  if (typeof cookieToken !== "string") {
    throw ApiError.unauthorized("No active session.");
  }

  if (req.headers.origin === env.clientUrl) {
    next();
    return;
  }

  const headerToken = req.headers["x-csrf-token"];
  if (typeof headerToken !== "string" || !csrfTokensMatch(cookieToken, headerToken)) {
    throw ApiError.forbidden("Missing or invalid CSRF token.");
  }

  next();
};
