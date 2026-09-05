import { Schema, model, type Document, type Types } from "mongoose";
import { baseSchemaOptions } from "./schemaOptions";

export type ChallengeType = "books" | "genre" | "pages";

export interface IChallenge extends Document {
  title: string;
  description: string;
  type: ChallengeType;
  // Required when type === "genre" — the category a "finished" book must
  // match to count toward progress. Ignored for "books"/"pages".
  genre?: string;
  target: number;
  periodStart: Date;
  periodEnd: Date;
  active: boolean;
  // Any user can create a challenge (community-driven, not admin-only);
  // createdBy records who so a creator gets notified when someone joins.
  createdBy: Types.ObjectId;
  // Optional club scope — a club can run its own reading sprint, shown on
  // that club's page, instead of every challenge being platform-wide.
  club?: Types.ObjectId;
  // Set only via the admin-gated create path — badges the card as
  // "LookBook Official" in the UI, the same "be honest about provenance"
  // convention Book.aiSummary already uses for AI-generated content.
  official: boolean;
  // Denormalized, kept in sync by ChallengeParticipant create/delete —
  // avoids a countDocuments() query every time a challenge card renders.
  participantsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const challengeSchema = new Schema<IChallenge>(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    type: { type: String, enum: ["books", "genre", "pages"], default: "books" },
    genre: { type: String, trim: true },
    // Criteria stays a single number — "N books/pages finished within the
    // period," optionally filtered to one genre — matching the §1.4
    // UserActivity log (action: "finished"). Richer multi-dimension criteria
    // can be added later without a migration (type is already extensible).
    target: { type: Number, required: true, min: 1 },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    club: { type: Schema.Types.ObjectId, ref: "Club", index: true },
    official: { type: Boolean, default: false },
    participantsCount: { type: Number, default: 0 },
  },
  { ...baseSchemaOptions }
);

export const Challenge = model<IChallenge>("Challenge", challengeSchema);
