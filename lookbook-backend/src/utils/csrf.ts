import crypto from "crypto";

export const generateCsrfToken = (): string => crypto.randomBytes(32).toString("hex");

/** Timing-safe compare — a plain `===` on tokens would leak length/prefix
 * info via response-time differences. */
export const csrfTokensMatch = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};
