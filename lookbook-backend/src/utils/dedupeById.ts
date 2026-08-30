/**
 * Deduplicates a list of documents by `.id`, keeping the first occurrence of
 * each. Homepage sections built from activity/order history (continueReading,
 * recentlyViewed) can otherwise repeat the same book once per matching
 * order/activity row — which isn't just a display glitch: React sees the
 * same list key twice and the section's rendering corrupts.
 *
 * `id` is optional here because it's a Mongoose virtual (optional on the
 * document interfaces); entries without one can't be keyed, so they're
 * dropped rather than collapsed together under a shared `undefined` key.
 */
export const dedupeById = <T extends { id?: string }>(items: T[]): T[] => {
  const byId = new Map<string, T>();
  for (const item of items) {
    if (!item.id || byId.has(item.id)) continue;
    byId.set(item.id, item);
  }
  return [...byId.values()];
};
