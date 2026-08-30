import { twoProportionZTest } from "./stats";

/**
 * §13.3 / §13.8 — shared AB-report computation, used by both the admin HTTP
 * endpoint and the offline `npm run eval:ab` CLI script so the two can never
 * drift. Input is a plain array of analytics events (already filtered to the
 * time window of interest).
 *
 * Attribution model: impressions come from `recommendation_view` events
 * (book-level, `data.bookIds`), clicks from `recommendation_click`
 * (`data.bookId`), and a conversion is a clicked book that the same session
 * later wishlist-added / added to cart / began checkout on.
 */

const CONVERSION_EVENTS = ["wishlist_add", "add_to_cart", "begin_checkout", "checkout_success"];

export interface AbEvent {
  event: string;
  sessionId?: string;
  data?: Record<string, unknown>;
}

export interface AbReport {
  impressions: Record<string, number>;
  clicks: Record<string, number>;
  conversions: Record<string, number>;
  arms: {
    arm: string;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    impressionToConversionRate: number;
    clickToConversionRate: number;
  }[];
  tests: {
    ctr: ReturnType<typeof twoProportionZTest>;
    clickToConversion: ReturnType<typeof twoProportionZTest>;
  };
  sources: { source: string; clicks: number; conversions: number; conversionRate: number }[];
}

export const computeAbReport = (events: AbEvent[]): AbReport => {
  const impressions: Record<string, number> = {};
  const clicks: Record<string, number> = {};
  const clickMetaBySessionBook = new Map<string, Map<string, { arm: string; section: string; reason: string }>>();
  const convertedBySession = new Map<string, Set<string>>();
  const clicksBySource = new Map<string, number>();
  const convertedBySource = new Map<string, number>();

  for (const ev of events) {
    const data = ev.data ?? {};
    const session = ev.sessionId ?? "none";

    if (ev.event === "recommendation_view") {
      const arm = typeof data.arm === "string" ? data.arm : "unknown";
      const ids = Array.isArray(data.bookIds)
        ? (data.bookIds as unknown[]).filter((x): x is string => typeof x === "string")
        : [];
      impressions[arm] = (impressions[arm] ?? 0) + ids.length;
    } else if (ev.event === "recommendation_click") {
      const arm = typeof data.arm === "string" ? data.arm : "unknown";
      const bookId = typeof data.bookId === "string" ? data.bookId : undefined;
      if (!bookId) continue;
      clicks[arm] = (clicks[arm] ?? 0) + 1;
      const meta = {
        arm,
        section: typeof data.section === "string" ? data.section : "unknown",
        reason: typeof data.reason === "string" ? data.reason : "unknown",
      };
      if (!clickMetaBySessionBook.has(session)) clickMetaBySessionBook.set(session, new Map());
      clickMetaBySessionBook.get(session)!.set(bookId, meta);
      const srcKey = `${meta.section} :: ${meta.reason}`;
      clicksBySource.set(srcKey, (clicksBySource.get(srcKey) ?? 0) + 1);
    } else if (CONVERSION_EVENTS.includes(ev.event)) {
      const bookId = typeof data.bookId === "string" ? data.bookId : undefined;
      if (bookId) {
        if (!convertedBySession.has(session)) convertedBySession.set(session, new Set());
        convertedBySession.get(session)!.add(bookId);
      }
    }
  }

  const convertedByArm: Record<string, number> = {};
  for (const [session, bookMeta] of clickMetaBySessionBook) {
    const converted = convertedBySession.get(session);
    if (!converted) continue;
    for (const [bookId, meta] of bookMeta) {
      if (converted.has(bookId)) {
        convertedByArm[meta.arm] = (convertedByArm[meta.arm] ?? 0) + 1;
        const srcKey = `${meta.section} :: ${meta.reason}`;
        convertedBySource.set(srcKey, (convertedBySource.get(srcKey) ?? 0) + 1);
      }
    }
  }

  const arms = ["hybrid", "popularity"].map((arm) => {
    const imp = impressions[arm] ?? 0;
    const clk = clicks[arm] ?? 0;
    const conv = convertedByArm[arm] ?? 0;
    return {
      arm,
      impressions: imp,
      clicks: clk,
      conversions: conv,
      ctr: imp > 0 ? clk / imp : 0,
      impressionToConversionRate: imp > 0 ? conv / imp : 0,
      clickToConversionRate: clk > 0 ? conv / clk : 0,
    };
  });

  const a = arms.find((s) => s.arm === "hybrid");
  const b = arms.find((s) => s.arm === "popularity");

  return {
    impressions,
    clicks,
    conversions: convertedByArm,
    arms,
    tests: {
      ctr: twoProportionZTest(
        { success: a?.clicks ?? 0, total: a?.impressions ?? 0 },
        { success: b?.clicks ?? 0, total: b?.impressions ?? 0 }
      ),
      clickToConversion: twoProportionZTest(
        { success: a?.conversions ?? 0, total: a?.clicks ?? 0 },
        { success: b?.conversions ?? 0, total: b?.clicks ?? 0 }
      ),
    },
    sources: [...clicksBySource.entries()]
      .map(([source, count]) => {
        const conversions = convertedBySource.get(source) ?? 0;
        return { source, clicks: count, conversions, conversionRate: count > 0 ? conversions / count : 0 };
      })
      .sort((x, y) => y.clicks - x.clicks),
  };
};