import crypto from "node:crypto";
import { env } from "../config/env";

/**
 * Stripe provider (future.md §2.1) — raw-fetch integration, same style as the
 * Razorpay util: order creation is our DB's source of truth, the hosted
 * Checkout Session is the client-side payment handle, and the signed webhook
 * is the authoritative "did it actually get paid" signal.
 *
 * Deliberately env-gated: STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET aren't
 * set in this environment, so the provider simply doesn't appear in the
 * payment-config endpoint until the user adds real keys.
 */

export const stripeConfigured = Boolean(env.stripe.secretKey);
export const stripePublishableConfigured = Boolean(env.stripe.publishableKey);

const FORM_CONTENT_TYPE = "application/x-www-form-urlencoded";

const stripeFetch = async (path: string, params: Record<string, string>): Promise<Record<string, unknown>> => {
  const form = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined));
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.stripe.secretKey}`,
      "Content-Type": FORM_CONTENT_TYPE,
    },
    body: form.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Stripe error ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as Record<string, unknown>;
};

/** Create a hosted Checkout Session so the buyer never handles a card locally. */
export const createStripeCheckoutSession = async (opts: {
  orderId: string;
  amountPaise: number; // INR, in paise
  items: { title: string; mode: string; quantity: number; price: number }[];
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionId: string; url: string }> => {
  const params: Record<string, string> = {
    mode: "payment",
    // Prices are stored/displayed in rupees; Stripe mandates minor units.
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    metadata_orderId: opts.orderId,
    customer_email: "", // filled by the frontend if the buyer is logged in
    line_items_0_quantity: "1",
    line_items_0_price_data_currency: "inr",
    line_items_0_price_data_unit_amount: String(opts.amountPaise),
    line_items_0_price_data_product_data_name: `LookBook order ${opts.orderId}`,
  };
  opts.items.forEach((it, i) => {
    params[`line_items_${i + 1}_quantity`] = String(it.quantity);
    params[`line_items_${i + 1}_price_data_currency`] = "inr";
    params[`line_items_${i + 1}_price_data_unit_amount`] = String(Math.round(it.price * 100));
    params[`line_items_${i + 1}_price_data_product_data_name`] = `${it.title} (${it.mode})`;
  });

  try {
    const session = await stripeFetch("/checkout/sessions", params);
    const id = session.id as string;
    const url = session.url as string;
    if (!id || !url) throw new Error("Missing session id/url");
    return { sessionId: id, url };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[stripe] createCheckoutSession failed:", String(err));
    throw err;
  }
};

/** Retrieve a Checkout Session's payment status (used by the client-side
 * verify-payment path after Stripe redirects the buyer back). */
export const retrieveStripeSession = async (
  sessionId: string
): Promise<{ status: string; paymentStatus: string } | null> => {
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${env.stripe.secretKey}` },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as Record<string, unknown>;
  return {
    status: String(body.status ?? ""),
    paymentStatus: String(body.payment_status ?? ""),
  };
};

/** Constant-time verification of the Stripe webhook signature. */
export const verifyStripeWebhookSignature = (rawBody: string, signatureHeader: string): boolean => {
  const parts = new Map(
    signatureHeader.split(",").map((p) => {
      const idx = p.indexOf("=");
      return [p.slice(0, idx), p.slice(idx + 1)];
    })
  );
  const ts = parts.get("t");
  const sig = parts.get("v1");
  if (!ts || !sig) return false;

  // Reject signatures older than 5 minutes (Stripe's "Timeout" in tz = skew guard).
  const ageMs = Date.now() - Number(ts) * 1000;
  if (Number.isNaN(ageMs) || abs(ageMs) > 5 * 60 * 1000) return false;

  const expected = crypto
    .createHmac("sha256", env.stripe.webhookSecret)
    .update(`${ts}.${rawBody}`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const abs = (n: number): number => (n < 0 ? -n : n);