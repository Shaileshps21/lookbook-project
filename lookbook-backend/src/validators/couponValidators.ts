import { z } from "zod";

export const createCouponSchema = z.object({
  code: z.string().trim().min(3).max(30),
  discountType: z.enum(["percent", "flat"]),
  discountValue: z.number().positive(),
  minOrderValue: z.number().min(0).optional().default(0),
  maxUses: z.number().int().min(0).optional().default(0),
  expiresAt: z.string().datetime().optional().or(z.literal("").transform(() => undefined)),
  active: z.boolean().optional().default(true),
});

export const updateCouponSchema = z.object({
  discountType: z.enum(["percent", "flat"]).optional(),
  discountValue: z.number().positive().optional(),
  minOrderValue: z.number().min(0).optional(),
  maxUses: z.number().int().min(0).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  active: z.boolean().optional(),
});

export const validateCouponSchema = z.object({
  code: z.string().trim().min(1, "Coupon code is required"),
  cartTotal: z.number().min(0),
});

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
export type ValidateCouponInput = z.infer<typeof validateCouponSchema>;
