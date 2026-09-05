import { Schema, model, type Document, type Types } from "mongoose";
import { baseSchemaOptions } from "./schemaOptions";

export interface IThread extends Document {
  title: string;
  content: string;
  images: string[];
  author: Types.ObjectId;
  club?: Types.ObjectId;
  book?: Types.ObjectId;
  commentsCount: number;
  likesCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const threadSchema = new Schema<IThread>(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    // The actual post body — previously a thread was title-only and every
    // real word of content lived in the comments underneath it. Not required
    // at the schema level (pre-existing demo threads have none) but the
    // controller requires it on every new post going forward.
    content: { type: String, trim: true, maxlength: 3000, default: "" },
    images: [{ type: String }],
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    club: { type: Schema.Types.ObjectId, ref: "Club", index: true },
    book: { type: Schema.Types.ObjectId, ref: "Book", index: true },
    commentsCount: { type: Number, default: 0 },
    likesCount: { type: Number, default: 0 },
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
