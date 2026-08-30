const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// One opaque id per browser, persisted, so anonymous funnel steps can be
// attributed to a session without any PII (future.md §11.1).
const SESSION_KEY = "lookbook_analytics_session";

const getSessionId = (): string => {
  try {
    let id = window.localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
      window.localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return `s_${Date.now().toString(36)}`;
  }
};

export type TrackEvent =
  | "page_view"
  | "product_view"
  | "add_to_cart"
  | "remove_from_cart"
  | "begin_checkout"
  | "checkout_success"
  | "search"
  | "ai_search"
  | "wishlist_add"
  | "seller_apply"
  | "listing_create"
  // §13.8 / §13.3 — homepage recommendation exposure + engagement. `data`
  // carries `{ arm, section, bookId(s), reason }` for AB attribution.
  | "recommendation_view"
  | "recommendation_click";

/** Fire-and-forget — never blocks or surfaces errors in the UI. */
export const track = (event: TrackEvent, data?: Record<string, unknown>): void => {
  try {
    navigator.sendBeacon?.(
      `${API_URL}/analytics/track`,
      new Blob(
        [JSON.stringify({ event, sessionId: getSessionId(), data, url: window.location.href })],
        { type: "application/json" }
      )
    );
  } catch {
    // best effort only
  }
};

export const trackPageView = (): void => track("page_view", { path: window.location.pathname });
