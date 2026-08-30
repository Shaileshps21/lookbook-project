import { Schema, model, type Document, type Types } from "mongoose";
import { baseSchemaOptions } from "./schemaOptions";

export interface IEvent extends Document {
  user?: Types.ObjectId;
  sessionId?: string;
  event: string;
  data?: Record<string, unknown>;
  url?: string;
  createdAt: Date;
}

/**
 * Self-hosted product analytics (future.md §11.1) — anonymous funnel/engagement
 * events (page_view, add_to_cart, begin_checkout, checkout, …) captured by the
 * frontend tracker and written here without any third-party service. Rolled up
 * for the admin dashboard alongside the business analytics snapshot.
 */
const eventSchema = new Schema<IEvent>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", index: true },
    sessionId: { type: String, index: true },
    event: { type: String, required: true, index: true },
    data: { type: Schema.Types.Mixed, default: {} },
    url: { type: String },
  },
  { ...baseSchemaOptions }
);

eventSchema.index({ event: 1, createdAt: -1 });

export const Event = model<IEvent>("Event", eventSchema);