import { Schema, model, type Document, type Types } from "mongoose";
import { baseSchemaOptions } from "./schemaOptions";

export type ListingStatus = "Pending" | "Approved" | "Rejected";
export type ListingCondition = "New" | "Like New" | "Good" | "Fair" | "Worn";

export interface IListing extends Document {
  user: Types.ObjectId;
  title: string;
  author: string;
  category: string;
  price: number;
  condition: ListingCondition;
  description?: string;
  images: string[];
  status: ListingStatus;
  linkedBookId?: Types.ObjectId;
  // AI duplicate-detection fields (§3.6)
  duplicateFlag: boolean;
  duplicateCandidate?: Types.ObjectId;
  duplicateReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const listingSchema = new Schema<IListing>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    category: { type: String, required: true },
    price: { type: Number, required: true, min: 1 },
    condition: {
      type: String,
      enum: ["New", "Like New", "Good", "Fair", "Worn"],
      default: "Good",
    },
    description: { type: String, maxlength: 1000 },
    images: [{ type: String }],
    status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending", index: true },
    linkedBookId: { type: Schema.Types.ObjectId, ref: "Book" },
    // AI duplicate detection (future.md §3.6)
    duplicateFlag: { type: Boolean, default: false, index: true },
    duplicateCandidate: { type: Schema.Types.ObjectId, ref: "Book" },
    duplicateReason: { type: String },
  },
  { ...baseSchemaOptions }
);

export const Listing = model<IListing>("Listing", listingSchema);
