import { Schema, model, type Document, type Types } from "mongoose";
import bcrypt from "bcryptjs";
import { baseSchemaOptions } from "./schemaOptions";

export type CartMode = "rent" | "buy";

export interface ICartItem {
  book: Types.ObjectId;
  mode: CartMode;
  quantity: number;
}

export interface IUserPreferences {
  genres: string[];
  authors: string[];
  readingGoal?: number;
  language?: string;
  onboardingCompleted: boolean;
}

export interface IEmailPreferences {
  orderUpdates: boolean;
  rentalReminders: boolean;
  priceDropAlerts: boolean;
  sellerNotifications: boolean;
  marketing: boolean;
}

export type RecommendationArm = "hybrid" | "popularity";

export type SellerApplicationStatus = "none" | "pending" | "approved" | "rejected";

export interface ISellerApplication {
  status: SellerApplicationStatus;
  requestedAt?: Date;
  reviewedAt?: Date;
  rejectionReason?: string;
}

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  avatar?: string;
  role: "user" | "admin";
  isSeller: boolean;
  sellerApplication: ISellerApplication;
  // future.md §13.3 — online A/B arm for homepage recommendations ("hybrid"
  // = the §3.2 pipeline, "popularity" = no-personalization control). No schema
  // default: assigned lazily on first homepage fetch so existing users are
  // randomized on first contact without any migration/backfill.
  recommendationArm?: RecommendationArm;
  suspended: boolean;
  suspendedReason?: string;
  publicProfile: boolean;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  twoFactorTempSecret?: string;
  wishlist: Types.ObjectId[];
  cart: ICartItem[];

  googleId?: string;
  githubId?: string;

  emailVerified: boolean;
  emailVerificationTokenHash?: string;
  emailVerificationExpires?: Date;

  passwordResetTokenHash?: string;
  passwordResetExpires?: Date;

  preferences: IUserPreferences;
  emailPreferences: IEmailPreferences;

  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const cartItemSchema = new Schema<ICartItem>(
  {
    book: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    mode: { type: String, enum: ["rent", "buy"], required: true },
    quantity: { type: Number, default: 1, min: 1 },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    // Not required at the schema level: OAuth-created accounts (Google/GitHub)
    // never set a password. Local registration still enforces a minimum
    // length at the Zod validator layer before this is ever reached.
    password: { type: String, minlength: 8, select: false },
    avatar: { type: String },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    isSeller: { type: Boolean, default: false },
    recommendationArm: { type: String, enum: ["hybrid", "popularity"] },
    sellerApplication: {
      status: { type: String, enum: ["none", "pending", "approved", "rejected"], default: "none" },
      requestedAt: { type: Date },
      reviewedAt: { type: Date },
      rejectionReason: { type: String },
    },
    suspended: { type: Boolean, default: false },
    suspendedReason: { type: String },
    publicProfile: { type: Boolean, default: false },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false },
    twoFactorTempSecret: { type: String, select: false },
    wishlist: [{ type: Schema.Types.ObjectId, ref: "Book" }],
    cart: [cartItemSchema],

    googleId: { type: String, index: true, sparse: true },
    githubId: { type: String, index: true, sparse: true },

    emailVerified: { type: Boolean, default: false },
    emailVerificationTokenHash: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },

    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },

    preferences: {
      genres: [{ type: String }],
      authors: [{ type: String }],
      readingGoal: { type: Number, min: 1 },
      language: { type: String },
      onboardingCompleted: { type: Boolean, default: false },
    },
    emailPreferences: {
      orderUpdates: { type: Boolean, default: true },
      rentalReminders: { type: Boolean, default: true },
      priceDropAlerts: { type: Boolean, default: true },
      sellerNotifications: { type: Boolean, default: true },
      marketing: { type: Boolean, default: true },
    },
  },
  { ...baseSchemaOptions }
);

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password") || !this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate: string) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.password);
};

export const User = model<IUser>("User", userSchema);
