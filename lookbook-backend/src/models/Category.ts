import { Schema, model, type Document } from "mongoose";
import { baseSchemaOptions } from "./schemaOptions";

export interface ICategory extends Document {
  name: string;
  count: number;
  image?: string;
}

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    count: { type: Number, default: 0, min: 0 },
    image: { type: String },
  },
  { ...baseSchemaOptions }
);

export const Category = model<ICategory>("Category", categorySchema);
