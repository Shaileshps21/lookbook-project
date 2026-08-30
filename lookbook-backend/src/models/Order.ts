import { Schema, model, type Document, type Types } from "mongoose";
import type { CartMode } from "./User";
import { baseSchemaOptions } from "./schemaOptions";

export type OrderStatus = "Placed" | "Active" | "Delivered" | "Returned" | "Cancelled";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export interface IDamageReport {
  reason: string;
  reportedAt: Date;
  status: "pending" | "resolved";
  feeCharged?: number;
}

export type PickupTimeSlot = "morning" | "afternoon" | "evening";

export interface IOrderItem {
  book: Types.ObjectId;
  mode: CartMode;
  quantity: number;
  price: number;
  dueDate?: Date;
  returnedAt?: Date;
  lateFee?: number;
  damageReport?: IDamageReport;
  reminderSentAt?: Date;
  // Buyer-initiated return pickup scheduling (future.md's Feature 5) — kept
  // distinct from the admin-set, order-level, free-text `pickupSlot` above
  // so a buyer's self-service pick can never collide with an admin's manual
  // tracking entry.
  pickupDate?: Date;
  pickupTimeSlot?: PickupTimeSlot;
  pickupScheduledAt?: Date;
}

export interface IOrder extends Document {
  user: Types.ObjectId;
  items: IOrderItem[];
  subtotal: number;
  delivery: number;
  total: number;
  status: OrderStatus;
  address?: string;

  // Delivery/shipment tracking (future.md §2.3). Shiprocket/courier API
  // integration needs credentials the environment doesn't have, so these are
  // populated via the admin Orders page (manual entry) and optionally by a
  // courier webhook later. Tracking is shown to the buyer on their Profile.
  trackingNumber?: string;
  carrier?: string;
  shipmentStatus?: "pending" | "in_transit" | "delivered" | "failed";
  trackingUrl?: string;
  pickupSlot?: string; // free-text pickup date/time for sell listings/returns

  couponCode?: string;
  discountAmount: number;

  paymentStatus: PaymentStatus;
  paymentProvider?: "razorpay" | "stripe";
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;

  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    book: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    mode: { type: String, enum: ["rent", "buy"], required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    dueDate: { type: Date },
    returnedAt: { type: Date },
    lateFee: { type: Number, min: 0, default: 0 },
    reminderSentAt: { type: Date },
    pickupDate: { type: Date },
    pickupTimeSlot: { type: String, enum: ["morning", "afternoon", "evening"] },
    pickupScheduledAt: { type: Date },
    damageReport: {
      reason: { type: String },
      reportedAt: { type: Date },
      status: { type: String, enum: ["pending", "resolved"] },
      feeCharged: { type: Number, min: 0 },
    },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    items: { type: [orderItemSchema], required: true, validate: (v: IOrderItem[]) => v.length > 0 },
    subtotal: { type: Number, required: true, min: 0 },
    delivery: { type: Number, required: true, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["Placed", "Active", "Delivered", "Returned", "Cancelled"],
      default: "Placed",
    },
    address: { type: String },

    trackingNumber: { type: String },
    carrier: { type: String },
    shipmentStatus: { type: String, enum: ["pending", "in_transit", "delivered", "failed"] },
    trackingUrl: { type: String },
    pickupSlot: { type: String },

    couponCode: { type: String },
    discountAmount: { type: Number, default: 0, min: 0 },

    paymentStatus: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending" },
    paymentProvider: { type: String, enum: ["razorpay", "stripe"] },
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String, select: false },
    stripeSessionId: { type: String, index: true },
    stripePaymentIntentId: { type: String },
  },
  { ...baseSchemaOptions }
);

// Verified-Reader checks, seller order/revenue queries, and reminder sweeps
// all filter by the book inside items, or by status — both hot paths added
// in Phase 5/6/7 that weren't covered by the original per-user index.
orderSchema.index({ "items.book": 1 });
orderSchema.index({ status: 1 });

export const Order = model<IOrder>("Order", orderSchema);
