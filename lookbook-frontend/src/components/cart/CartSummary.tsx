import { useState } from "react";
import { ShieldCheck, QrCode, CreditCard, Tag, X } from "lucide-react";
import Button from "../common/Button";
import { formatPrice } from "../../utils/format";
import { ApiClientError } from "../../services/apiClient";
import { validateCoupon } from "../../services/couponService";

interface CartSummaryProps {
  subtotal: number;
  itemCount: number;
  onCheckout: (couponCode?: string) => Promise<void>;
  onUpiCheckout: (couponCode?: string) => Promise<void>;
  stripeAvailable?: boolean;
  onStripeCheckout?: (couponCode?: string) => Promise<void>;
}

const CartSummary = ({
  subtotal,
  itemCount,
  onCheckout,
  onUpiCheckout,
  stripeAvailable,
  onStripeCheckout,
}: CartSummaryProps) => {
  const [checkedOut, setCheckedOut] = useState(false);
  const [loading, setLoading] = useState<"card" | "upi" | "stripe" | null>(null);
  const [error, setError] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number } | null>(null);
  const delivery = subtotal > 0 ? 40 : 0;
  const preDiscountTotal = subtotal + delivery;
  const total = Math.max(preDiscountTotal - (appliedCoupon?.discountAmount ?? 0), 0);

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setApplyingCoupon(true);
    setCouponError("");
    try {
      const result = await validateCoupon(couponInput.trim(), preDiscountTotal);
      if (result.valid) {
        setAppliedCoupon({ code: couponInput.trim().toUpperCase(), discountAmount: result.discountAmount });
      } else {
        setCouponError(result.message);
      }
    } catch (err) {
      setCouponError(err instanceof ApiClientError ? err.message : "Couldn't validate this coupon.");
    } finally {
      setApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError("");
  };

  // Stripe redirects the browser to its hosted checkout, so "checked out" is
  // the honest state; the /orders/:id/payment-success page finalizes it.
  const run = async (kind: "card" | "upi" | "stripe", action: (couponCode?: string) => Promise<void>) => {
    setLoading(kind);
    setError("");
    try {
      await action(appliedCoupon?.code);
      if (kind !== "stripe") setCheckedOut(true);
    } catch (err) {
      setError(
        err instanceof ApiClientError || err instanceof Error ? err.message : "Couldn't process the payment. Please try again."
      );
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-amber-100 shadow-sm sticky top-28">
      <h3 className="text-lg font-bold text-slate-900 mb-5">Order Summary</h3>

      <div className="space-y-3 text-slate-600">
        <div className="flex justify-between">
          <span>Items ({itemCount})</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Delivery</span>
          <span>{delivery === 0 ? "Free" : formatPrice(delivery)}</span>
        </div>
        {appliedCoupon && (
          <div className="flex justify-between text-green-600 font-medium">
            <span>Discount ({appliedCoupon.code})</span>
            <span>-{formatPrice(appliedCoupon.discountAmount)}</span>
          </div>
        )}
      </div>

      {!checkedOut && (
        <div className="mt-4">
          {appliedCoupon ? (
            <div className="flex items-center justify-between bg-green-50 rounded-xl px-3 py-2 text-sm text-green-700">
              <span className="flex items-center gap-1.5 font-semibold">
                <Tag size={13} /> {appliedCoupon.code} applied
              </span>
              <button onClick={handleRemoveCoupon} aria-label="Remove coupon" className="text-green-600 hover:text-green-800">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder="Coupon code"
                className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
              />
              <button
                onClick={handleApplyCoupon}
                disabled={applyingCoupon || !couponInput.trim()}
                className="text-xs font-semibold px-4 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition disabled:opacity-50"
              >
                {applyingCoupon ? "Checking..." : "Apply"}
              </button>
            </div>
          )}
          {couponError && <p className="text-red-500 text-xs mt-2">{couponError}</p>}
        </div>
      )}

      <div className="border-t border-dashed border-slate-200 my-5" />

      <div className="flex justify-between text-lg font-bold text-slate-900 mb-6">
        <span>Total</span>
        <span>{formatPrice(total)}</span>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <Button fullWidth onClick={() => run("card", onCheckout)} disabled={itemCount === 0 || loading !== null || checkedOut}>
        {checkedOut ? "Order Placed 🎉" : loading === "card" ? "Placing Order..." : "Proceed to Checkout"}
      </Button>

      {stripeAvailable && (
        <button
          onClick={() => onStripeCheckout && run("stripe", onStripeCheckout)}
          disabled={itemCount === 0 || loading !== null || checkedOut}
          className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-full border border-slate-200 text-slate-700 font-medium hover:border-indigo-300 hover:bg-indigo-50 transition disabled:opacity-50"
        >
          <CreditCard size={16} /> {loading === "stripe" ? "Opening Stripe..." : "Pay with Card (Stripe)"}
        </button>
      )}

      <button
        onClick={() => onUpiCheckout && run("upi", onUpiCheckout)}
        disabled={itemCount === 0 || loading !== null || checkedOut}
        className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-full border border-slate-200 text-slate-700 font-medium hover:border-amber-300 hover:bg-amber-50 transition disabled:opacity-50"
      >
        <QrCode size={16} /> {loading === "upi" ? "Opening UPI..." : checkedOut ? "Paid via UPI 🎉" : "Pay via UPI (QR Code)"}
      </button>

      <div className="flex items-center gap-2 mt-4 text-xs text-slate-400">
        <ShieldCheck size={14} /> Secure checkout &middot; Easy returns
      </div>
    </div>
  );
};

export default CartSummary;