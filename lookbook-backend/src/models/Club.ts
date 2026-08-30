import crypto from "crypto";
import { Schema, model, type Document, type Types } from "mongoose";
import { baseSchemaOptions } from "./schemaOptions";

export interface IClub extends Document {
  name: string;
  description: string;
  book?: Types.ObjectId;
  owner: Types.ObjectId;
  members: Types.ObjectId[];
  // Shareable invite link (future.md's Feature 10) — every club gets one at
  // creation; the owner can disable or regenerate it without deleting the club.
  inviteToken: string;
  inviteEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const clubSchema = new Schema<IClub>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    book: { type: Schema.Types.ObjectId, ref: "Book" },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    members: [{ type: Schema.Types.ObjectId, ref: "User" }],
    inviteToken: {
      type: String,
      unique: true,
      sparse: true,
      default: () => crypto.randomBytes(16).toString("hex"),
    },
    inviteEnabled: { type: Boolean, default: true },
  },
  { ...baseSchemaOptions }
);

export const Club = model<IClub>("Club", clubSchema);
