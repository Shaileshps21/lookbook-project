import { Schema, model, type Document, type Types } from "mongoose";
import { baseSchemaOptions } from "./schemaOptions";

export interface IAiSummary {
  keyTakeaways: string[];
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  readingTimeHours: number;
  targetAudience: string;
  topicsCovered: string[];
}

export interface IReviewAnalysis {
  positivePercent: number;
  commonPros: string[];
  commonCons: string[];
  emotionalTone: string;
  generatedAt: Date;
  reviewCountAtGeneration: number;
}

export interface IBook extends Document {
  title: string;
  author: string;
  image?: string;
  category: string;
  rentPrice: number;
  buyPrice: number;
  rating: number;
  reviewsCount: number;
  description: string;
  // Optional: seller-listed used books (see Phase 5) rarely have this
  // metadata to hand; admin-catalog books still fill it in via the Zod
  // validator on the admin create-book form, which keeps it required there.
  publisher?: string;
  published?: string;
  pages?: number;
  language: string;
  isbn?: string;
  stock: number;
  badge?: string;
  tags: string[];
  embedding?: number[];
  aiSummary?: IAiSummary;
  reviewAnalysis?: IReviewAnalysis;
  // Set only for books that entered the catalog through the Sell → approval
  // flow (see future.md Phase 5) — admin-seeded catalog books have neither.
  sellerId?: Types.ObjectId;
  condition?: "New" | "Like New" | "Good" | "Fair" | "Worn";

  // Smart/dynamic pricing (future.md Stretch 2) — when enabled, a scheduled
  // job adjusts rentPrice within these admin-set bounds based on recent
  // demand signals. Defaults keep it off so plain catalog books never change
  // price until an admin opts in on the specific book.
  pricing?: {
    enabled: boolean;
    minRentPrice: number;
    maxRentPrice: number;
    lastPricingAt?: Date;
    lastReason?: string;
  };

  createdAt: Date;
  updatedAt: Date;
}

const bookSchema = new Schema<IBook>(
  {
    title: { type: String, required: true, trim: true, index: true },
    author: { type: String, required: true, trim: true, index: true },
    image: { type: String },
    category: { type: String, required: true, index: true },
    rentPrice: { type: Number, required: true, min: 0 },
    buyPrice: { type: Number, required: true, min: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewsCount: { type: Number, default: 0, min: 0 },
    description: { type: String, required: true },
    publisher: { type: String },
    published: { type: String },
    pages: { type: Number, min: 1 },
    language: { type: String, required: true, default: "English" },
    // Uniqueness is enforced by the partial index declared below, not here —
    // `sparse` only skips documents where the field is *absent*, so an
    // explicit `isbn: null` still gets indexed and collides with every other
    // null. Books legitimately have no ISBN (seller listings, older titles),
    // so a partial index scoped to real strings is the correct constraint.
    isbn: { type: String },
    stock: { type: Number, required: true, default: 0, min: 0 },
    badge: { type: String },
    tags: [{ type: String, index: true }],
    embedding: { type: [Number], select: false },
    aiSummary: {
      keyTakeaways: [{ type: String }],
      difficulty: { type: String, enum: ["Beginner", "Intermediate", "Advanced"] },
      readingTimeHours: { type: Number },
      targetAudience: { type: String },
      topicsCovered: [{ type: String }],
    },
    reviewAnalysis: {
      positivePercent: { type: Number },
      commonPros: [{ type: String }],
      commonCons: [{ type: String }],
      emotionalTone: { type: String },
      generatedAt: { type: Date },
      reviewCountAtGeneration: { type: Number },
    },
    sellerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    condition: { type: String, enum: ["New", "Like New", "Good", "Fair", "Worn"] },
    pricing: {
      enabled: { type: Boolean, default: false },
      minRentPrice: { type: Number, min: 0, default: 0 },
      maxRentPrice: { type: Number, min: 0, default: 0 },
      lastPricingAt: { type: Date },
      lastReason: { type: String },
    },
  },
  { ...baseSchemaOptions }
);

bookSchema.index({ title: "text", author: "text", tags: "text" });
// §13.2.2 — homepage "popular" / "new releases" sections sorted these before
// the indexes existed, forcing COLLSCAN on every homepage load. Both feed the
// highest-traffic endpoint, so index them.
bookSchema.index({ rating: -1, reviewsCount: -1 });
bookSchema.index({ createdAt: -1 });
// ISBNs are unique only among books that actually have one. A plain unique
// index (what the live DB had) indexes a missing/null field as null, so the
// *second* ISBN-less book ever created collides — which silently made every
// seller listing without an ISBN impossible to approve.
bookSchema.index(
  { isbn: 1 },
  { unique: true, partialFilterExpression: { isbn: { $type: "string" } } }
);

bookSchema.pre("save", function (next) {
  if (typeof this.isbn === "string") {
    this.isbn = this.isbn.replace(/[^0-9Xx]/g, "").toUpperCase();
  }
  next();
});

export const Book = model<IBook>("Book", bookSchema);
