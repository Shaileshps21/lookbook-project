import { Schema, model, type Document, type Types } from "mongoose";
import { baseSchemaOptions } from "./schemaOptions";

export interface IBadge extends Document {
  user: Types.ObjectId;
  challenge: Types.ObjectId;
  title: string;
  awardedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const badgeSchema = new Schema<IBadge>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    challenge: { type: Schema.Types.ObjectId, ref: "Challenge", required: true },
    title: { type: String, required: true },
    awardedAt: { type: Date, required: true, default: Date.now },
  },
  { ...baseSchemaOptions }
);

// A user earns each challenge's badge at most once.
badgeSchema.index({ user: 1, challenge: 1 }, { unique: true });

export const Badge = model<IBadge>("Badge", badgeSchema);
