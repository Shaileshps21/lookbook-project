import rateLimit from "express-rate-limit";

/** Shared factory for the per-route limiters below — same shape as the
 * existing auth limiter (authRoutes.ts), just parameterized per use case. */
const makeLimiter = (windowMs: number, max: number, message: string) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message },
  });

// Reviews and listings are cheap to spam and easy for a bot/script to
// hammer; checkout is rate-limited to blunt scripted order/inventory abuse
// rather than genuine repeat legitimate checkouts (limit is generous).
export const reviewLimiter = makeLimiter(60 * 60 * 1000, 20, "Too many reviews submitted. Please try again later.");
export const listingLimiter = makeLimiter(60 * 60 * 1000, 10, "Too many listings submitted. Please try again later.");
export const checkoutLimiter = makeLimiter(10 * 60 * 1000, 15, "Too many checkout attempts. Please slow down.");

// AI endpoints proxy to paid Gemini/Groq APIs, so per-IP abuse isn't just a
// DB-write cost like reviews — a scripted loop would burn real money. Limit is
// generous enough that a genuine user hitting chat/scan/search a few times a
// minute is never blocked, but a bot hammering the endpoints gets cut off.
export const aiLimiter = makeLimiter(60 * 1000, 20, "Too many AI requests. Please slow down and try again.");
