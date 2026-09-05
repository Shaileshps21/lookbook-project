import { Schema, model, type Document, type Types } from "mongoose";
import { baseSchemaOptions } from "./schemaOptions";

export type NotificationType =
  | "order.confirmed"
  | "order.refunded"
  | "rental.due"
  | "seller.approved"
  | "seller.rejected"
  | "price.drop"
  | "payout.resolved"
  | "order.pickupScheduled"
  | "community.like"
  | "community.comment"
  | "community.follow"
  | "community.challengeJoined"
  | "community.challengeCompleted";

export interface INotification extends Document {
  user: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String },
    read: { type: Boolean, default: false },
  },
  { ...baseSchemaOptions }
);

notificationSchema.index({ user: 1, createdAt: -1 });

export const Notification = model<INotification>("Notification", notificationSchema);
