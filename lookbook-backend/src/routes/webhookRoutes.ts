import { Router } from "express";
import { handleRazorpayWebhook, handleStripeWebhook } from "../controllers/orderController";
import { stripeConfigured } from "../utils/stripe";

const router = Router();

router.post("/razorpay", handleRazorpayWebhook);
// Stripe webhook is only mounted when the provider is actually configured.
if (stripeConfigured) {
  router.post("/stripe", handleStripeWebhook);
}

export default router;
