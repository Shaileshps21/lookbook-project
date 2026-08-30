import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { Coupon } from "../models/Coupon";
import { validateCouponForCart } from "../utils/coupon";
import type { CreateCouponInput, UpdateCouponInput, ValidateCouponInput } from "../validators/couponValidators";

export const listCoupons = asyncHandler(async (_req: Request, res: Response) => {
  const coupons = await Coupon.find().sort("-createdAt");
  return ApiResponse.ok(res, coupons);
});

export const createCoupon = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateCouponInput;

  const existing = await Coupon.findOne({ code: input.code.toUpperCase() });
  if (existing) throw ApiError.conflict("A coupon with this code already exists.");

  const coupon = await Coupon.create({
    ...input,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
  });

  return ApiResponse.created(res, coupon, "Coupon created");
});

export const updateCoupon = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as UpdateCouponInput;

  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) throw ApiError.notFound("Coupon not found");

  if (input.discountType !== undefined) coupon.discountType = input.discountType;
  if (input.discountValue !== undefined) coupon.discountValue = input.discountValue;
  if (input.minOrderValue !== undefined) coupon.minOrderValue = input.minOrderValue;
  if (input.maxUses !== undefined) coupon.maxUses = input.maxUses;
  if (input.active !== undefined) coupon.active = input.active;
  if (input.expiresAt !== undefined) coupon.expiresAt = input.expiresAt ? new Date(input.expiresAt) : undefined;

  await coupon.save();
  return ApiResponse.ok(res, coupon, "Coupon updated");
});

export const deleteCoupon = asyncHandler(async (req: Request, res: Response) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) throw ApiError.notFound("Coupon not found");

  coupon.active = false;
  await coupon.save();

  return ApiResponse.ok(res, coupon, "Coupon deactivated");
});

export const validateCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { code, cartTotal } = req.body as ValidateCouponInput;
  const result = await validateCouponForCart(code, cartTotal);

  return ApiResponse.ok(res, {
    valid: result.valid,
    discountAmount: result.discountAmount,
    finalTotal: result.finalTotal,
    message: result.message,
  });
});
