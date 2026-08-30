import { api } from "./apiClient";
import type { Coupon } from "../types";

export interface CouponValidation {
  valid: boolean;
  discountAmount: number;
  finalTotal: number;
  message: string;
}

export const validateCoupon = async (code: string, cartTotal: number): Promise<CouponValidation> => {
  const { data } = await api.post<CouponValidation>("/coupons/validate", { code, cartTotal });
  return data;
};

export interface CreateCouponInput {
  code: string;
  discountType: "percent" | "flat";
  discountValue: number;
  minOrderValue?: number;
  maxUses?: number;
  expiresAt?: string;
  active?: boolean;
}

export const fetchAdminCoupons = async (): Promise<Coupon[]> => {
  const { data } = await api.get<Coupon[]>("/admin/coupons");
  return data;
};

export const createAdminCoupon = async (input: CreateCouponInput): Promise<Coupon> => {
  const { data } = await api.post<Coupon>("/admin/coupons", input);
  return data;
};

export const updateAdminCoupon = async (id: string, input: Partial<CreateCouponInput>): Promise<Coupon> => {
  const { data } = await api.patch<Coupon>(`/admin/coupons/${id}`, input);
  return data;
};

export const deleteAdminCoupon = async (id: string): Promise<Coupon> => {
  const { data } = await api.delete<Coupon>(`/admin/coupons/${id}`);
  return data;
};
