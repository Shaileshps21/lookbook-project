import { Schema, model, type Document } from "mongoose";
import { baseSchemaOptions } from "./schemaOptions";

export interface IPlan extends Document {
  name: string;
  price: number;
  period: "month" | "year";
  tagline: string;
  features: string[];
  highlighted: boolean;
}

const planSchema = new Schema<IPlan>(
  {
    name: { type: String, required: true, unique: true },
    price: { type: Number, required: true, min: 0 },
    period: { type: String, enum: ["month", "year"], default: "month" },
    tagline: { type: String, required: true },
    features: [{ type: String }],
    highlighted: { type: Boolean, default: false },
  },
  { ...baseSchemaOptions }
);

export const Plan = model<IPlan>("Plan", planSchema);
