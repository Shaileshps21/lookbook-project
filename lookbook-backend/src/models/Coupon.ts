import { Schema, model, type Document } from "mongoose";
import { baseSchemaOptions } from "./schemaOptions";

export type DiscountType = "percent" | "flat";

export interface ICoupon extends Document {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderValue: number;
  maxUses: number; // 0 = unlimited
  usedCount: number;
  expiresAt?: Date;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const couponSchema = new Schema<ICoupon>(
  {
    code: { type: String, required: true, uppercase: true, trim: true, unique: true },
    discountType: { type: String, enum: ["percent", "flat"], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    minOrderValue: { type: Number, default: 0, min: 0 },
    maxUses: { type: Number, default: 0, min: 0 },
    usedCount: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date },
    active: { type: Boolean, default: true },
  },
  { ...baseSchemaOptions }
);

couponSchema.index({ active: 1, expiresAt: 1 });

export const Coupon = model<ICoupon>("Coupon", couponSchema);
