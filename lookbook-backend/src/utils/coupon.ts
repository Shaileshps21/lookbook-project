import { Coupon, type ICoupon } from "../models/Coupon";

export interface CouponValidationResult {
  valid: boolean;
  message: string;
  coupon?: ICoupon;
  discountAmount: number;
  finalTotal: number;
}

/** Server-side-only discount computation (future.md's Feature 6) — shared by
 * the standalone /coupons/validate preview and checkout itself, so the two
 * can never compute a different number for the same code. Never trusts a
 * client-submitted discount; only ever recomputes from the stored coupon. */
export const validateCouponForCart = async (
  code: string | undefined,
  cartTotal: number
): Promise<CouponValidationResult> => {
  if (!code?.trim()) {
    return { valid: false, message: "No coupon code provided.", discountAmount: 0, finalTotal: cartTotal };
  }

  const coupon = await Coupon.findOne({ code: code.trim().toUpperCase() });
  if (!coupon || !coupon.active) {
    return { valid: false, message: "This coupon code doesn't exist or is no longer active.", discountAmount: 0, finalTotal: cartTotal };
  }
  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    return { valid: false, message: "This coupon has expired.", discountAmount: 0, finalTotal: cartTotal };
  }
  if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
    return { valid: false, message: "This coupon has reached its usage limit.", discountAmount: 0, finalTotal: cartTotal };
  }
  if (cartTotal < coupon.minOrderValue) {
    return {
      valid: false,
      message: `Minimum order value of ₹${coupon.minOrderValue} required for this coupon.`,
      discountAmount: 0,
      finalTotal: cartTotal,
    };
  }

  const rawDiscount =
    coupon.discountType === "percent" ? (cartTotal * coupon.discountValue) / 100 : coupon.discountValue;
  // Never let a coupon discount past 0, or "flat" past the cart total itself.
  const discountAmount = Math.min(Math.round(rawDiscount), cartTotal);
  const finalTotal = Math.max(cartTotal - discountAmount, 0);

  return { valid: true, message: `Coupon applied — ₹${discountAmount} off!`, coupon, discountAmount, finalTotal };
};
