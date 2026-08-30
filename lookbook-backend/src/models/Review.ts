import { Schema, model, type Document, type Types } from "mongoose";
import { baseSchemaOptions } from "./schemaOptions";

export interface IReview extends Document {
  book: Types.ObjectId;
  user: Types.ObjectId;
  name: string;
  rating: number;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    book: { type: Schema.Types.ObjectId, ref: "Book", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { ...baseSchemaOptions }
);

// One review per user per book
reviewSchema.index({ book: 1, user: 1 }, { unique: true });

export const Review = model<IReview>("Review", reviewSchema);
