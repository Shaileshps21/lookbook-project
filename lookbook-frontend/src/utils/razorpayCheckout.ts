// Thin wrapper around Razorpay's official checkout.js embed script.
// https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: { ondismiss?: () => void };
  theme?: { color?: string };
  config?: {
    display: {
      blocks: Record<string, { name: string; instruments: { method: string }[] }>;
      sequence: string[];
      preferences: { show_default_blocks: boolean };
    };
  };
}

// Scopes the widget straight to its UPI view (skipping the payment-method
// picker) — Razorpay's own UPI block already renders a real scannable QR
// code alongside the "collect"/intent options, so this needs no separate
// QR-generation API (that product isn't enabled on every account).
const UPI_ONLY_CONFIG: RazorpayOptions["config"] = {
  display: {
    blocks: {
      upi: { name: "Pay via UPI", instruments: [{ method: "upi" }] },
    },
    sequence: ["block.upi"],
    preferences: { show_default_blocks: false },
  },
};

export interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

let loadPromise: Promise<void> | null = null;

const loadRazorpayScript = (): Promise<void> => {
  if (window.Razorpay) return Promise.resolve();
  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Couldn't load the payment widget. Check your connection."));
      document.body.appendChild(script);
    });
  }
  return loadPromise;
};

export const openRazorpayCheckout = async (params: {
  keyId: string;
  amount: number;
  currency: string;
  orderId: string;
  description: string;
  upiOnly?: boolean;
}): Promise<RazorpaySuccessResponse> => {
  await loadRazorpayScript();

  return new Promise((resolve, reject) => {
    if (!window.Razorpay) {
      reject(new Error("Payment widget failed to initialize."));
      return;
    }
    const instance = new window.Razorpay({
      key: params.keyId,
      amount: params.amount,
      currency: params.currency,
      name: "LookBook",
      description: params.description,
      order_id: params.orderId,
      handler: (response) => resolve(response),
      modal: { ondismiss: () => reject(new Error("Payment cancelled.")) },
      theme: { color: "#d97706" },
      ...(params.upiOnly ? { config: UPI_ONLY_CONFIG } : {}),
    });
    instance.open();
  });
};
