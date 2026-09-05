export interface AiSummary {
  keyTakeaways: string[];
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  readingTimeHours: number;
  targetAudience: string;
  topicsCovered: string[];
}

export interface ReviewAnalysis {
  positivePercent: number;
  commonPros: string[];
  commonCons: string[];
  emotionalTone: string;
  generatedAt: string;
  reviewCountAtGeneration: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  image: string;
  category: string;
  rentPrice: number;
  buyPrice: number;
  rating: number;
  reviewsCount: number;
  description: string;
  publisher?: string;
  published?: string;
  pages?: number;
  language: string;
  isbn?: string;
  stock: number;
  badge?: string;
  tags: string[];
  aiSummary?: AiSummary;
  reviewAnalysis?: ReviewAnalysis;
  sellerId?: string;
  condition?: "New" | "Like New" | "Good" | "Fair" | "Worn";
  // Smart rental pricing config (Stretch 2) — admin-configured bounds for the
  // daily rule-based price adjustment job.
  pricing?: { enabled: boolean; minRentPrice: number; maxRentPrice: number };
}

export interface Review {
  id: string;
  bookId: string;
  name: string;
  rating: number;
  date: string;
  comment: string;
  verifiedReader?: boolean;
}

export interface Category {
  id: string;
  name: string;
  count: number;
  image: string;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  period: "month" | "year";
  tagline: string;
  features: string[];
  highlighted?: boolean;
}

export type CartMode = "rent" | "buy";

export interface CartItem {
  book: Book;
  mode: CartMode;
  quantity: number;
}

export interface UserPreferences {
  genres: string[];
  authors: string[];
  readingGoal?: number;
  language?: string;
  onboardingCompleted: boolean;
}

export type SellerApplicationStatus = "none" | "pending" | "approved" | "rejected";

export interface SellerApplication {
  status: SellerApplicationStatus;
  requestedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface EmailPreferences {
  orderUpdates: boolean;
  rentalReminders: boolean;
  priceDropAlerts: boolean;
  sellerNotifications: boolean;
  marketing: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  joined: string;
  role?: "user" | "admin";
  emailVerified?: boolean;
  preferences?: UserPreferences;
  emailPreferences?: EmailPreferences;
  isSeller?: boolean;
  sellerApplication?: SellerApplication;
  publicProfile?: boolean;
  twoFactorEnabled?: boolean;
}

export interface ReadingStats {
  booksRead: number;
  finishedBookIds: string[];
  moneySaved: number;
  favouriteGenres: string[];
  favouriteAuthors: string[];
  readingGoal: number | null;
  booksFinishedThisMonth: number;
  streak: number;
  calendar: { date: string; count: number }[];
  monthlyBooks: { month: string; count: number }[];
  genreBreakdown: { genre: string; count: number }[];
}

export interface SustainabilityImpact {
  booksReused: number;
  paperSavedKg: number;
  co2ReducedKg: number;
  treesSaved: number;
}

export interface SustainabilityStats {
  personal: SustainabilityImpact;
  community: SustainabilityImpact;
  assumptions: { paperKgPerRental: number; co2KgPerRental: number; rentalsPerTreeSaved: number };
}

export interface Homepage {
  coldStart: boolean;
  /** §13.3 — which recommendation arm served this page ("hybrid" | "popularity"). */
  arm?: "hybrid" | "popularity";
  /** §13.8 — bookId → human-readable explainability label ("Because you read X"). */
  reasons?: Record<string, string>;
  newReleases: Book[];
  popularInGenre: Book[];
  continueReading: Book[];
  recentlyViewed: Book[];
  recommendedForYou: Book[];
  becauseYouRead: { sourceBook: Book | null; books: Book[] };
  similarToWishlist: Book[];
}

export interface Session {
  id: string;
  userAgent?: string;
  ip?: string;
  lastUsedAt: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

export type OrderStatus = "Placed" | "Active" | "Delivered" | "Returned" | "Cancelled";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export interface DamageReport {
  reason: string;
  reportedAt: string;
  status: "pending" | "resolved";
  feeCharged?: number;
}

export type PickupTimeSlot = "morning" | "afternoon" | "evening";

export interface OrderItem {
  book: Book;
  mode: CartMode;
  quantity: number;
  price: number;
  dueDate?: string;
  returnedAt?: string;
  lateFee?: number;
  damageReport?: DamageReport;
  pickupDate?: string;
  pickupTimeSlot?: PickupTimeSlot;
  pickupScheduledAt?: string;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: "percent" | "flat";
  discountValue: number;
  minOrderValue: number;
  maxUses: number;
  usedCount: number;
  expiresAt?: string;
  active: boolean;
  createdAt: string;
}

export interface Order {
  id: string;
  items: OrderItem[];
  subtotal: number;
  delivery: number;
  total: number;
  couponCode?: string;
  discountAmount?: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  address?: string;
  createdAt: string;
  user?: { name: string; email: string };
  razorpayPaymentId?: string;
  // Delivery tracking (§2.3) — populated by admin
  trackingNumber?: string;
  carrier?: string;
  shipmentStatus?: "pending" | "in_transit" | "delivered" | "failed";
  trackingUrl?: string;
  pickupSlot?: string;
}

export type ListingStatus = "Pending" | "Approved" | "Rejected";
export type ListingCondition = "New" | "Like New" | "Good" | "Fair" | "Worn";

export interface Listing {
  id: string;
  title: string;
  author: string;
  category: string;
  price: number;
  condition: ListingCondition;
  description?: string;
  images: string[];
  status: ListingStatus;
  createdAt: string;
  user?: { name: string; email: string };
  // AI duplicate detection fields (§3.6)
  duplicateFlag?: boolean;
  duplicateReason?: string;
  duplicateCandidate?: { id: string; title: string; author: string; image: string } | null;
}

export type ShelfVisibility = "private" | "public";

export interface Shelf {
  id: string;
  name: string;
  visibility: ShelfVisibility;
  isDefault: boolean;
  books: Book[];
  createdAt: string;
}

export interface PublicUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface PublicReadingStats {
  streak: number;
  booksRead: number;
  favouriteGenres: string[];
  genreBreakdown: { genre: string; count: number }[];
  monthlyBooks: { month: string; count: number }[];
}

export interface PublicChallengeProgress {
  id: string;
  title: string;
  target: number;
  progress: number;
}

export interface PublicProfile {
  user: PublicUser;
  followers: number;
  following: number;
  isFollowing: boolean;
  shelves: Shelf[];
  reviews: Review[];
  readingStats: PublicReadingStats;
  badges: Badge[];
  challengesInProgress: PublicChallengeProgress[];
  clubs: { id: string; name: string }[];
  mutualFollowers: { id: string; name: string }[];
  mutualFollowersCount: number;
}

export interface DirectoryUser {
  id: string;
  name: string;
  avatar?: string;
  topGenre: string | null;
  followers: number;
  badgesCount: number;
  isFollowing: boolean;
}

export interface Club {
  id: string;
  name: string;
  description: string;
  book?: { id: string; title: string; image: string; author?: string };
  owner: PublicUser;
  members: PublicUser[];
  createdAt: string;
  inviteToken?: string;
  inviteEnabled?: boolean;
  inviteUrl?: string;
}

export interface ClubInvitePreview {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  book?: { id: string; title: string; image: string; author?: string };
  owner: { name: string };
}

export interface Thread {
  id: string;
  title: string;
  content: string;
  images: string[];
  author: PublicUser;
  club?: string;
  book?: string;
  commentsCount: number;
  likesCount: number;
  likedByMe: boolean;
  createdAt: string;
}

export interface Comment {
  id: string;
  thread: string;
  author: PublicUser;
  content: string;
  likesCount: number;
  likedByMe: boolean;
  createdAt: string;
}

export type ChallengeType = "books" | "genre" | "pages";

export interface Challenge {
  id: string;
  title: string;
  description: string;
  type: ChallengeType;
  genre?: string;
  target: number;
  periodStart: string;
  periodEnd: string;
  active: boolean;
  club?: { id: string; name: string };
  createdBy?: { id: string; name: string };
  official: boolean;
  participantsCount: number;
  joined: boolean;
  awardedAt?: string | null;
}

export interface ChallengeProgress {
  progress: number;
  target: number;
  completed: boolean;
  justCompleted?: boolean;
  awardedAt: string | null;
}

export interface Badge {
  id: string;
  title: string;
  awardedAt: string;
  challenge: { id: string; title: string; description: string };
}

export interface LeaderboardRow {
  userId: string;
  name: string;
  avatar?: string;
  booksFinished: number;
  rank: number;
}

export interface LeaderboardData {
  rows: LeaderboardRow[];
  viewerRank: LeaderboardRow | null;
  totalParticipants: number;
}

export interface MyChallenges {
  active: Challenge[];
  completed: Challenge[];
}
