import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { useCart } from "../hooks/useCart";
import { useAuth } from "../hooks/useAuth";
import CartLineItem from "../components/cart/CartLineItem";
import CartSummary from "../components/cart/CartSummary";
import EmptyState from "../components/ui/EmptyState";
import { checkout, verifyPayment } from "../services/orderService";
import { fetchClientConfig } from "../services/adminService";
import { openRazorpayCheckout } from "../utils/razorpayCheckout";
import { ApiClientError } from "../services/apiClient";

const Cart = () => {
  const { items, subtotal, itemCount, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stripeAvailable, setStripeAvailable] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchClientConfig()
      .then((config) => setStripeAvailable(config.stripe.available))
      .catch(() => setStripeAvailable(false));
  }, []);

  const payAndConfirm = async (upiOnly: boolean, couponCode?: string) => {
    if (!user) {
      navigate("/login", { state: { from: "/cart" } });
      return;
    }
    setError("");
    try {
      const result = await checkout(undefined, "razorpay", couponCode);

      const payment = await openRazorpayCheckout({
        keyId: result.razorpay.keyId,
        amount: result.razorpay.amount,
        currency: result.razorpay.currency,
        orderId: result.razorpay.orderId,
        description: `${itemCount} book${itemCount === 1 ? "" : "s"} from LookBook`,
        upiOnly,
      });

      await verifyPayment(result.order.id, "razorpay", payment);
      clearCart();
      navigate("/profile", { state: { justOrdered: true } });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't complete the checkout. Please try again.");
    }
  };

  const payWithStripe = async (couponCode?: string) => {
    if (!user) {
      navigate("/login", { state: { from: "/cart" } });
      return;
    }
    setError("");
    try {
      // The backend creates a hosted Stripe Checkout Session and returns its
      // URL; we hand the buyer over to Stripe, who redirects back to
      // /orders/:id/payment-success after paying (finalization happens there).
      const result = await checkout(undefined, "stripe", couponCode);
      window.location.assign(result.stripe.url);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't start the checkout. Please try again.");
    }
  };

  return (
    <section className="bg-[#F5F2EA] py-16 min-h-[80vh]">
      <div className="max-w-6xl mx-auto px-6">
        <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-10">Your Cart</h1>

        {items.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Your cart is empty"
            description="Looks like you haven't added any books yet. Start exploring our catalog."
            actionLabel="Browse Books"
            actionTo="/categories"
          />
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-5">
              {items.map((item) => (
                <CartLineItem key={`${item.book.id}-${item.mode}`} item={item} />
              ))}
            </div>

            <div>
              {error && <p className="text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm mb-4">{error}</p>}
              <CartSummary
                subtotal={subtotal}
                itemCount={itemCount}
                onCheckout={(couponCode) => payAndConfirm(false, couponCode)}
                onUpiCheckout={(couponCode) => payAndConfirm(true, couponCode)}
                stripeAvailable={stripeAvailable}
                onStripeCheckout={payWithStripe}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default Cart;