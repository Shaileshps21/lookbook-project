import { UserActivity, ACTIVITY_WEIGHTS, type ActivityAction } from "../models/UserActivity";
import { invalidateCache } from "../config/redis";

/**
 * Best-effort activity log — never awaited by callers, never throws into the
 * request path. Losing a signal event is fine; breaking a checkout/review/
 * wishlist action because analytics failed to write is not.
 *
 * Also invalidates the user's cached homepage (see homepageController.ts),
 * which is keyed per-user with a 1h TTL and nothing was busting it — every
 * new activity signal (view/wishlist/rent/buy/review/finished) is exactly
 * what should make personalization change, so serving the stale cached
 * snapshot made it look like "personalization isn't working".
 */
export const logActivity = (userId: string, bookId: string, action: ActivityAction): void => {
  UserActivity.create({ user: userId, book: bookId, action, weight: ACTIVITY_WEIGHTS[action] }).catch(
    () => {
      // eslint-disable-next-line no-console
      console.warn(`[activity] Failed to log ${action} for user ${userId} / book ${bookId}`);
    }
  );
  void invalidateCache(`homepage:${userId}`);
};
