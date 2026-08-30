import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { Event } from "../models/Event";
import { computeAbReport } from "../utils/abStats";

const ALLOWED_EVENTS = [
  "page_view",
  "product_view",
  "add_to_cart",
  "remove_from_cart",
  "begin_checkout",
  "checkout_success",
  "search",
  "ai_search",
  "wishlist_add",
  "seller_apply",
  "listing_create",
  // §13.8 / §13.3 — homepage recommendation exposure + engagement. `data`
  // carries `{ arm, section, bookId(s), reason }` for attribution.
  "recommendation_view",
  "recommendation_click",
];

/**
 * POST /api/analytics/track — fire-and-forget ingestion from the frontend
 * tracker. Public: attribution relies on a client-generated sessionId plus
 * the (optional) authenticated user id, never on secrets.
 */
export const trackEvent = asyncHandler(async (req: Request, res: Response) => {
  const { event, sessionId, data, url } = req.body as {
    event?: string;
    sessionId?: string;
    data?: Record<string, unknown>;
    url?: string;
  };
  if (!event || !ALLOWED_EVENTS.includes(event)) {
    throw ApiError.badRequest("Unknown event type.");
  }

  await Event.create({
    event,
    sessionId: typeof sessionId === "string" && sessionId ? sessionId.slice(0, 200) : undefined,
    data: data && typeof data === "object" ? data : {},
    url: typeof url === "string" ? url.slice(0, 500) : undefined,
    user: req.user?.id,
  });

  // Always 204-ish success so the tracker never blocks the UI.
  return ApiResponse.ok(res, null, "ok");
});

const rangeBounds = (days: number): [Date, Date] => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  return [start, end];
};

/** Funnel aggregation for the admin dashboard — count each step by unique
 * session (anonymous) or user id (logged-in), over a trailing window. */
const funnelOver = async (
  start: Date,
  end: Date
): Promise<Record<string, { count: number; sessions: number }>> => {
  const rows = await Event.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    { $group: { _id: "$event", count: { $sum: 1 }, sessions: { $addToSet: "$sessionId" } } },
    { $project: { _id: 0, event: "$_id", count: 1, sessions: { $size: "$sessions" } } },
  ]);
  const out: Record<string, { count: number; sessions: number }> = {};
  for (const row of rows) out[row.event] = { count: row.count, sessions: row.sessions };
  return out;
};

const dailyEvents = async (start: Date, end: Date): Promise<{ date: string; total: number }[]> =>
  Event.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        total: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: "$_id", total: 1 } },
  ]);

/** GET /api/admin/analytics/events — funnel + daily volume for the admin UI. */
export const getProductAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const days = Math.min(Math.max(Number(req.query.days ?? 7), 1), 90);
  const [start, end] = rangeBounds(days);

  const [funnel, daily] = await Promise.all([funnelOver(start, end), dailyEvents(start, end)]);
  return ApiResponse.ok(res, { days, funnel, daily });
});

const CONVERSION_EVENTS = ["wishlist_add", "add_to_cart", "begin_checkout", "checkout_success"];

/**
 * GET /api/admin/analytics/ab-report — §13.3 online A/B results for the
 * homepage recommendation experiment ("hybrid" §3.2 pipeline vs "popularity"
 * control), plus a §13.8 breakdown of click/conversion by recommendation
 * source ("Because you read X", "Trending in Y", …). See utils/abStats.ts for
 * the computation (shared with the offline CLI).
 */
export const getAbReport = asyncHandler(async (req: Request, res: Response) => {
  const days = Math.min(Math.max(Number(req.query.days ?? 30), 1), 90);
  const [start, end] = rangeBounds(days);

  const events = await Event.find({
    createdAt: { $gte: start, $lte: end },
    event: { $in: ["recommendation_view", "recommendation_click", ...CONVERSION_EVENTS] },
  })
    .select("event sessionId data")
    .lean();

  const report = computeAbReport(
    events.map((e) => ({ event: e.event, sessionId: e.sessionId, data: e.data as Record<string, unknown> | undefined }))
  );

  return ApiResponse.ok(res, { days, ...report });
});