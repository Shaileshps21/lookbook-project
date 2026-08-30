import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import Button from "../components/common/Button";
import { useCart } from "../hooks/useCart";
import { useAuth } from "../hooks/useAuth";
import { verifyPayment } from "../services/orderService";

/**
 * Stripe redirect target (§2.1). After the buyer completes the hosted
 * Checkout, Stripe sends them back here with ?session_id=…; this page calls
 * the backend's verify-payment endpoint (idempotent server-side) to finalize
 * the order, then clears the cart.
 */
const PaymentSuccess = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const { clearCart } = useCart();
  const { user } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const firedRef = useRef(false);

  useEffect(() => {
    if (!orderId || !sessionId) return;

    // Session restore (AuthContext refresh) is async — wait for the user to be
    // resolved so the auth header is present, then finalize exactly once.
    if (!user || firedRef.current) return;
    firedRef.current = true;

    const finalize = async () => {
      try {
        await verifyPayment(orderId, "stripe", { stripe_session_id: sessionId });
        clearCart();
        setStatus("success");
      } catch {
        setStatus("error");
      }
    };

    finalize();
  }, [orderId, sessionId, user, clearCart]);

  return (
    <section className="bg-[#F5F2EA] py-24 min-h-[70vh]">
      <div className="max-w-lg mx-auto px-6 text-center bg-white rounded-3xl border border-amber-100 shadow-sm p-12">
        {status === "loading" && (
          <>
            <Loader2 size={44} className="text-amber-500 mx-auto animate-spin" />
            <h1 className="text-2xl font-bold text-slate-900 mt-6">Confirming your payment…</h1>
            <p className="text-slate-500 mt-2">Hang tight, we're finalizing your order with the payment provider.</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 size={52} className="text-green-500 mx-auto" />
            <h1 className="text-2xl font-bold text-slate-900 mt-6">Payment successful!</h1>
            <p className="text-slate-500 mt-2">Your order has been confirmed. You can track it from your profile.</p>
            <Link to="/profile" className="inline-block mt-8">
              <Button>View My Orders</Button>
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <AlertTriangle size={52} className="text-amber-500 mx-auto" />
            <h1 className="text-2xl font-bold text-slate-900 mt-6">Something went wrong</h1>
            <p className="text-slate-500 mt-2">
              We couldn't confirm that payment. If money was taken, it will be refunded automatically — otherwise head back to your cart.
            </p>
            <Link to="/cart" className="inline-block mt-8">
              <Button>Back to Cart</Button>
            </Link>
          </>
        )}
      </div>
    </section>
  );
};

export default PaymentSuccess;