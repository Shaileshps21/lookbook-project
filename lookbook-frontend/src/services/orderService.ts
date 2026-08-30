import { api } from "./apiClient";
import type { Order } from "../types";

export interface RazorpayCheckoutData {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export type CheckoutResponse =
  | { order: Order; provider: "razorpay"; razorpay: RazorpayCheckoutData }
  | { order: Order; provider: "stripe"; stripe: { sessionId: string; url: string } };

export const checkout = async <P extends "razorpay" | "stripe">(
  address?: string,
  provider: P = "razorpay" as P,
  couponCode?: string
): Promise<Extract<CheckoutResponse, { provider: P }>> => {
  const { data } = await api.post<CheckoutResponse>("/orders/checkout", { address, provider, couponCode });
  return data as Extract<CheckoutResponse, { provider: P }>;
};

export const verifyPayment = async (
  orderId: string,
  provider: "razorpay" | "stripe",
  payload:
    | { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
    | { stripe_session_id: string }
): Promise<Order> => {
  const { data } = await api.post<Order>(`/orders/${orderId}/verify-payment`, { provider, ...payload });
  return data;
};

export const cancelOrder = async (orderId: string): Promise<Order> => {
  const { data } = await api.post<Order>(`/orders/${orderId}/cancel`);
  return data;
};

export const fetchMyOrders = async (): Promise<Order[]> => {
  const { data } = await api.get<Order[]>("/orders");
  return data;
};

export const fetchOrderById = async (id: string): Promise<Order> => {
  const { data } = await api.get<Order>(`/orders/${id}`);
  return data;
};

export const returnOrderItem = async (orderId: string, itemIndex: number): Promise<Order> => {
  const { data } = await api.post<Order>(`/orders/${orderId}/items/${itemIndex}/return`);
  return data;
};

export interface ExtendRentalResponse {
  razorpay: { orderId: string; amount: number; currency: string; keyId: string };
  extensionFee: number;
  extensionDays: number;
}

export const extendRental = async (orderId: string, itemIndex: number): Promise<ExtendRentalResponse> => {
  const { data } = await api.post<ExtendRentalResponse>(`/orders/${orderId}/items/${itemIndex}/extend`);
  return data;
};

export const verifyExtensionPayment = async (
  orderId: string,
  itemIndex: number,
  payload: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
): Promise<Order> => {
  const { data } = await api.post<Order>(`/orders/${orderId}/items/${itemIndex}/verify-extension`, payload);
  return data;
};

export const reportDamage = async (orderId: string, itemIndex: number, reason: string): Promise<Order> => {
  const { data } = await api.post<Order>(`/orders/${orderId}/items/${itemIndex}/report-damage`, { reason });
  return data;
};

export const schedulePickup = async (
  orderId: string,
  itemIndex: number,
  pickupDate: string,
  pickupTimeSlot: "morning" | "afternoon" | "evening"
): Promise<Order> => {
  const { data } = await api.post<Order>(`/orders/${orderId}/items/${itemIndex}/schedule-pickup`, {
    pickupDate,
    pickupTimeSlot,
  });
  return data;
};