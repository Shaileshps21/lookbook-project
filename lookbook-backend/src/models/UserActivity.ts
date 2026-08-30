import { Schema, model, type Document, type Types } from "mongoose";

export type ActivityAction = "view" | "wishlist" | "rent" | "buy" | "review" | "finished";

export interface IUserActivity extends Document {
  user: Types.ObjectId;
  book: Types.ObjectId;
  action: ActivityAction;
  weight: number;
  createdAt: Date;
}

// Higher weight = stronger taste signal. Used both to rank "recent" activity
// and to weight books when averaging embeddings into a user's taste vector.
export const ACTIVITY_WEIGHTS: Record<ActivityAction, number> = {
  view: 1,
  wishlist: 3,
  review: 4,
  rent: 5,
  buy: 6,
  finished: 2,
};

const userActivitySchema = new Schema<IUserActivity>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    book: { type: Schema.Types.ObjectId, ref: "Book", required: true, index: true },
    action: { type: String, enum: Object.keys(ACTIVITY_WEIGHTS), required: true },
    weight: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

userActivitySchema.index({ user: 1, createdAt: -1 });
// The reading-challenge leaderboard aggregation filters by action + a date
// range across all users, not scoped to one user — a separate index for it.
userActivitySchema.index({ action: 1, createdAt: -1 });

export const UserActivity = model<IUserActivity>("UserActivity", userActivitySchema);
