import crypto from "crypto";
import { env } from "../config/env";

const authHeader = () =>
  `Basic ${Buffer.from(`${env.razorpay.keyId}:${env.razorpay.keySecret}`).toString("base64")}`;

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

/** Amounts are in the smallest currency unit (paise for INR), per Razorpay's API. */
export const createRazorpayOrder = async (amountInRupees: number, receipt: string): Promise<RazorpayOrder> => {
  if (!env.razorpay.keyId || !env.razorpay.keySecret) {
    throw new Error("Razorpay is not configured (missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET).");
  }

  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader() },
    body: JSON.stringify({
      amount: Math.round(amountInRupees * 100),
      currency: "INR",
      receipt,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Razorpay order creation failed: ${res.status} ${body}`);
  }

  return res.json() as Promise<RazorpayOrder>;
};

/** Verifies the signature Razorpay's checkout `handler` callback returns after a successful payment. */
export const verifyPaymentSignature = (params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): boolean => {
  const expected = crypto
    .createHmac("sha256", env.razorpay.keySecret)
    .update(`${params.razorpayOrderId}|${params.razorpayPaymentId}`)
    .digest("hex");
  return expected === params.razorpaySignature;
};

/** Verifies the `X-Razorpay-Signature` header on incoming webhook payloads. */
export const verifyWebhookSignature = (rawBody: string, signature: string): boolean => {
  if (!env.razorpay.webhookSecret) return false;
  const expected = crypto.createHmac("sha256", env.razorpay.webhookSecret).update(rawBody).digest("hex");
  return expected === signature;
};

export const createRefund = async (paymentId: string, amountInRupees?: number): Promise<void> => {
  const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader() },
    body: JSON.stringify(amountInRupees ? { amount: Math.round(amountInRupees * 100) } : {}),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Razorpay refund failed: ${res.status} ${body}`);
  }
};
