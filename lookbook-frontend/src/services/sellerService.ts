import { api } from "./apiClient";
import type { Book } from "../types";

export const fetchInventory = async (): Promise<Book[]> => {
  const { data } = await api.get<Book[]>("/seller/inventory");
  return data;
};

export const updateInventoryItem = async (
  bookId: string,
  updates: { rentPrice?: number; buyPrice?: number; stock?: number }
): Promise<Book> => {
  const { data } = await api.patch<Book>(`/seller/inventory/${bookId}`, updates);
  return data;
};

export const delistInventoryItem = (bookId: string) => api.delete<null>(`/seller/inventory/${bookId}`);

export interface SellerOrderItem {
  book: { id: string; title: string; image: string };
  mode: "rent" | "buy";
  quantity: number;
  price: number;
}

export interface SellerOrder {
  id: string;
  createdAt: string;
  status: string;
  paymentStatus: string;
  buyer: { name: string; email: string };
  items: SellerOrderItem[];
}

export const fetchSellerOrders = async (): Promise<SellerOrder[]> => {
  const { data } = await api.get<SellerOrder[]>("/seller/orders");
  return data;
};

export interface Payout {
  id: string;
  amount: number;
  status: "requested" | "paid" | "rejected";
  requestedAt: string;
  resolvedAt?: string;
  note?: string;
}

export interface SellerRevenue {
  grossRevenue: number;
  commissionRate: number;
  commission: number;
  netEarnings: number;
  paidOut: number;
  pendingRequests: number;
  availableBalance: number;
  payouts: Payout[];
}

export const fetchSellerRevenue = async (): Promise<SellerRevenue> => {
  const { data } = await api.get<SellerRevenue>("/seller/revenue");
  return data;
};

export const requestPayoutRequest = async (amount: number): Promise<Payout> => {
  const { data } = await api.post<Payout>("/seller/payouts", { amount });
  return data;
};

export interface SellerPerformanceRow {
  bookId: string;
  title: string;
  views: number;
  wishlists: number;
  purchases: number;
}

export const fetchSellerPerformance = async (): Promise<SellerPerformanceRow[]> => {
  const { data } = await api.get<SellerPerformanceRow[]>("/seller/performance");
  return data;
};
