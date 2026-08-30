import { Schema, model, type Document } from "mongoose";
import { baseSchemaOptions } from "./schemaOptions";

export interface ITopBook {
  bookId: string;
  title: string;
  count: number;
}

export interface IGenrePopularity {
  category: string;
  count: number;
}

export interface IAnalyticsSnapshot extends Document {
  date: string; // "YYYY-MM-DD", one document per day
  revenue: number;
  ordersCount: number;
  newUsers: number;
  activeUsers: number;
  membershipRevenue: number;
  sellerRevenue: number;
  topRentedBooks: ITopBook[];
  topSoldBooks: ITopBook[];
  genrePopularity: IGenrePopularity[];
}

const topBookSchema = new Schema<ITopBook>(
  { bookId: String, title: String, count: Number },
  { _id: false }
);

const genrePopularitySchema = new Schema<IGenrePopularity>({ category: String, count: Number }, { _id: false });

const analyticsSnapshotSchema = new Schema<IAnalyticsSnapshot>(
  {
    date: { type: String, required: true, unique: true },
    revenue: { type: Number, default: 0 },
    ordersCount: { type: Number, default: 0 },
    newUsers: { type: Number, default: 0 },
    activeUsers: { type: Number, default: 0 },
    membershipRevenue: { type: Number, default: 0 },
    sellerRevenue: { type: Number, default: 0 },
    topRentedBooks: [topBookSchema],
    topSoldBooks: [topBookSchema],
    genrePopularity: [genrePopularitySchema],
  },
  { ...baseSchemaOptions }
);

export const AnalyticsSnapshot = model<IAnalyticsSnapshot>("AnalyticsSnapshot", analyticsSnapshotSchema);
