import { Schema, model, type Document } from "mongoose";
import { baseSchemaOptions } from "./schemaOptions";

export interface IChallenge extends Document {
  title: string;
  description: string;
  target: number;
  periodStart: Date;
  periodEnd: Date;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const challengeSchema = new Schema<IChallenge>(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    // Criteria is intentionally kept to a single dimension — "N books
    // finished within the period" — matching the §1.4 UserActivity log
    // (action: "finished"). Richer criteria types can be added later.
    target: { type: Number, required: true, min: 1 },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    active: { type: Boolean, default: true },
  },
  { ...baseSchemaOptions }
);

export const Challenge = model<IChallenge>("Challenge", challengeSchema);
