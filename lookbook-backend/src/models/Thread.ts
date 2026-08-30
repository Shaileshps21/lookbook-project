import { Schema, model, type Document, type Types } from "mongoose";
import { baseSchemaOptions } from "./schemaOptions";

export interface IThread extends Document {
  title: string;
  author: Types.ObjectId;
  club?: Types.ObjectId;
  book?: Types.ObjectId;
  commentsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const threadSchema = new Schema<IThread>(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    club: { type: Schema.Types.ObjectId, ref: "Club", index: true },
    book: { type: Schema.Types.ObjectId, ref: "Book", index: true },
    commentsCount: { type: Number, default: 0 },
  },
  { ...baseSchemaOptions }
);

// A thread must be scoped to exactly one of club/book.
threadSchema.pre("validate", function validateScope(next) {
  if (!this.club && !this.book) {
    next(new Error("A thread must be scoped to a club or a book."));
    return;
  }
  next();
});

export const Thread = model<IThread>("Thread", threadSchema);
