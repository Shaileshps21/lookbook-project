import { Schema, model, type Document, type Types } from "mongoose";
import { baseSchemaOptions } from "./schemaOptions";

/**
 * The explicit "join" step a challenge previously had no way to represent —
 * every logged-in user was implicitly "in" every challenge, which is why the
 * old leaderboard felt random and "My Challenges" couldn't exist. Joining
 * makes participation, and the leaderboard, actually mean something.
 */
export interface IChallengeParticipant extends Document {
  user: Types.ObjectId;
  challenge: Types.ObjectId;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const challengeParticipantSchema = new Schema<IChallengeParticipant>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    challenge: { type: Schema.Types.ObjectId, ref: "Challenge", required: true, index: true },
    joinedAt: { type: Date, required: true, default: Date.now },
  },
  { ...baseSchemaOptions }
);

challengeParticipantSchema.index({ user: 1, challenge: 1 }, { unique: true });

export const ChallengeParticipant = model<IChallengeParticipant>(
  "ChallengeParticipant",
  challengeParticipantSchema
);
