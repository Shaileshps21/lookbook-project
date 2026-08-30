import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { User } from "../models/User";
import { Follow } from "../models/Follow";
import { Shelf } from "../models/Shelf";
import { Review } from "../models/Review";
import { invalidateCache } from "../config/redis";
import { sanitizeUser } from "../utils/sanitizeUser";
import type { UpdatePreferencesInput, UpdateMeInput, UpdateEmailPreferencesInput } from "../validators/userValidators";

export const updatePreferences = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { genres, authors, readingGoal, language } = req.body as UpdatePreferencesInput;

  req.user.preferences = {
    genres,
    authors,
    readingGoal,
    language,
    onboardingCompleted: true,
  };
  await req.user.save();
  // The homepage's "Popular In Your Favourite Genre" section and coldStart
  // flag are both derived from preferences.genres — without this, a user
  // who'd already loaded the homepage once would keep seeing their old
  // (possibly cold-start) snapshot for up to the cache's 1h TTL.
  await invalidateCache(`homepage:${req.user.id}`);

  return ApiResponse.ok(res, { preferences: req.user.preferences }, "Preferences saved");
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { name, avatar } = req.body as UpdateMeInput;
  if (name !== undefined) req.user.name = name;
  if (avatar !== undefined) req.user.avatar = avatar;
  await req.user.save();

  return ApiResponse.ok(res, { user: sanitizeUser(req.user) }, "Profile updated");
});

export const updateEmailPreferences = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const updates = req.body as UpdateEmailPreferencesInput;
  req.user.emailPreferences = { ...req.user.emailPreferences, ...updates };
  await req.user.save();

  return ApiResponse.ok(res, { emailPreferences: req.user.emailPreferences }, "Email preferences updated");
});

export const skipOnboarding = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  req.user.preferences.onboardingCompleted = true;
  await req.user.save();

  return ApiResponse.ok(res, { preferences: req.user.preferences }, "Onboarding skipped");
});

export const applyToSell = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  if (req.user.isSeller) {
    throw ApiError.conflict("You're already an approved seller.");
  }
  if (req.user.sellerApplication.status === "pending") {
    throw ApiError.conflict("Your seller application is already pending review.");
  }

  req.user.sellerApplication = { status: "pending", requestedAt: new Date() };
  await req.user.save();

  return ApiResponse.ok(res, { sellerApplication: req.user.sellerApplication }, "Seller application submitted");
});

export const updatePublicProfileSetting = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { publicProfile } = req.body as { publicProfile: boolean };
  req.user.publicProfile = Boolean(publicProfile);
  await req.user.save();

  return ApiResponse.ok(res, { publicProfile: req.user.publicProfile }, "Profile visibility updated");
});

/** Own-profile stats not already covered by cart/wishlist/orders — currently
 * just the review count (`ProfileStats` on the frontend). */
export const getMyStats = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const reviewsCount = await Review.countDocuments({ user: req.user.id });

  return ApiResponse.ok(res, { reviewsCount });
});

/** Opt-in public view: name, avatar, follow counts, public shelves, and reviews. */
export const getPublicProfile = asyncHandler(async (req: Request, res: Response) => {
  const profileUser = await User.findById(req.params.userId).select("name avatar publicProfile");
  if (!profileUser || !profileUser.publicProfile) {
    throw ApiError.notFound("Profile not found or not public");
  }

  const [followers, following, isFollowing, shelves, reviews] = await Promise.all([
    Follow.countDocuments({ following: profileUser.id }),
    Follow.countDocuments({ follower: profileUser.id }),
    req.user ? Follow.exists({ follower: req.user.id, following: profileUser.id }) : Promise.resolve(null),
    Shelf.find({ user: profileUser.id, visibility: "public" }).populate("books"),
    Review.find({ user: profileUser.id }).sort("-createdAt").limit(20).populate("book", "title image"),
  ]);

  return ApiResponse.ok(res, {
    user: { id: profileUser.id, name: profileUser.name, avatar: profileUser.avatar },
    followers,
    following,
    isFollowing: Boolean(isFollowing),
    shelves,
    reviews,
  });
});
