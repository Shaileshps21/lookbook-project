import { Schema, model, type Document, type Types } from "mongoose";
import { baseSchemaOptions } from "./schemaOptions";

export type PayoutStatus = "requested" | "paid" | "rejected";

export interface IPayout extends Document {
  seller: Types.ObjectId;
  amount: number;
  status: PayoutStatus;
  requestedAt: Date;
  resolvedAt?: Date;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const payoutSchema = new Schema<IPayout>(
  {
    seller: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["requested", "paid", "rejected"], default: "requested" },
    requestedAt: { type: Date, default: () => new Date() },
    resolvedAt: { type: Date },
    note: { type: String },
  },
  { ...baseSchemaOptions }
);

export const Payout = model<IPayout>("Payout", payoutSchema);
