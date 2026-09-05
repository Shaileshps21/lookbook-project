import { Schema, model, type Document, type Types } from "mongoose";
import { baseSchemaOptions } from "./schemaOptions";

export interface IComment extends Document {
  thread: Types.ObjectId;
  author: Types.ObjectId;
  content: string;
  likesCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    thread: { type: Schema.Types.ObjectId, ref: "Thread", required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, trim: true, maxlength: 2000 },
    likesCount: { type: Number, default: 0 },
  },
  { ...baseSchemaOptions }
);

export const Comment = model<IComment>("Comment", commentSchema);
