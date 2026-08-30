import { Schema, model, type Document, type Types } from "mongoose";
import { baseSchemaOptions } from "./schemaOptions";

export type ShelfVisibility = "private" | "public";

export interface IShelf extends Document {
  user: Types.ObjectId;
  name: string;
  visibility: ShelfVisibility;
  isDefault: boolean;
  books: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const shelfSchema = new Schema<IShelf>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    visibility: { type: String, enum: ["private", "public"], default: "private" },
    isDefault: { type: Boolean, default: false },
    books: [{ type: Schema.Types.ObjectId, ref: "Book" }],
  },
  { ...baseSchemaOptions }
);

// A user can't have two shelves with the same name.
shelfSchema.index({ user: 1, name: 1 }, { unique: true });

export const Shelf = model<IShelf>("Shelf", shelfSchema);
