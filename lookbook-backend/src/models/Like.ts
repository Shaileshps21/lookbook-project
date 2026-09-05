import { Schema, model, type Document, type Types } from "mongoose";
import { baseSchemaOptions } from "./schemaOptions";

export type LikeTargetType = "thread" | "comment";

export interface ILike extends Document {
  user: Types.ObjectId;
  targetType: LikeTargetType;
  target: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const likeSchema = new Schema<ILike>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    targetType: { type: String, enum: ["thread", "comment"], required: true },
    target: { type: Schema.Types.ObjectId, required: true, index: true },
  },
  { ...baseSchemaOptions }
);

// A user can't double-like the same post/comment — same idempotency pattern
// as Follow's { follower, following } unique index.
likeSchema.index({ user: 1, targetType: 1, target: 1 }, { unique: true });

export const Like = model<ILike>("Like", likeSchema);
