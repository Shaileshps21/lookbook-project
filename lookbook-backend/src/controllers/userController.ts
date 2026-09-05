import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { User } from "../models/User";
import { Follow } from "../models/Follow";
import { Shelf } from "../models/Shelf";
import { Review } from "../models/Review";
import { Badge } from "../models/Badge";
import { Club } from "../models/Club";
import { ChallengeParticipant } from "../models/ChallengeParticipant";
import { Challenge } from "../models/Challenge";
import { invalidateCache } from "../config/redis";
import { sanitizeUser } from "../utils/sanitizeUser";
import { computeReadingStats } from "../utils/readingStats";
import { computeChallengeProgressBatch } from "../utils/challengeProgress";
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

/** Opt-in public view: name, avatar, follow counts, reading taste, badges,
 * in-progress challenges, clubs, public shelves, and reviews. Everything
 * here is gated behind the same single `publicProfile` boolean the base
 * fields already required — no new privacy granularity, matching the
 * project's existing all-or-nothing model rather than a settings matrix
 * nobody asked for. */
export const getPublicProfile = asyncHandler(async (req: Request, res: Response) => {
  const profileUser = await User.findById(req.params.userId).select("name avatar publicProfile");
  if (!profileUser || !profileUser.publicProfile) {
    throw ApiError.notFound("Profile not found or not public");
  }

  const [
    followers,
    following,
    isFollowing,
    shelves,
    reviews,
    readingStats,
    badges,
    clubs,
    myFollowingIds,
  ] = await Promise.all([
    Follow.countDocuments({ following: profileUser.id }),
    Follow.countDocuments({ follower: profileUser.id }),
    req.user ? Follow.exists({ follower: req.user.id, following: profileUser.id }) : Promise.resolve(null),
    Shelf.find({ user: profileUser.id, visibility: "public" }).populate("books"),
    Review.find({ user: profileUser.id }).sort("-createdAt").limit(20).populate("book", "title image"),
    computeReadingStats(profileUser.id),
    Badge.find({ user: profileUser.id }).populate("challenge", "title description").sort("-awardedAt"),
    Club.find({ members: profileUser.id }).select("name").limit(12),
    req.user ? Follow.find({ follower: req.user.id }).select("following") : Promise.resolve([]),
  ]);

  // In-progress (not yet completed) challenges the profile owner has
  // joined, most-recently-joined first, capped at 3 — enough to show "what
  // they're working on" from a friend's profile without duplicating the
  // full Challenges page here.
  // `badges` is populated (challenge → { id, title, description } for
  // display below), so `.challenge` is a Document, not a raw ObjectId — its
  // own `.id` virtual is what gives back the challenge's id string here,
  // not `.toString()` (which would stringify the populated object itself).
  const completedChallengeIds = new Set(badges.map((b) => (b.challenge as unknown as { id: string }).id));
  const participations = await ChallengeParticipant.find({ user: profileUser.id })
    .sort("-joinedAt")
    .limit(10)
    .select("challenge");
  const inProgressIds = participations.map((p) => p.challenge.toString()).filter((id) => !completedChallengeIds.has(id));
  const inProgressChallenges = await Challenge.find({ _id: { $in: inProgressIds.slice(0, 3) } });

  const challengesInProgress =
    inProgressChallenges.length > 0 ? await computeChallengeProgressBatch(profileUser.id, inProgressChallenges) : [];

  // Mutual followers: people the viewer follows who also follow this
  // profile owner — the "Followed by X, Y +N" social-proof line.
  let mutualFollowers: { id: string; name: string }[] = [];
  if (req.user && req.user.id !== profileUser.id) {
    const myFollowingIdList = (myFollowingIds as { following: unknown }[]).map((f) => f.following);
    if (myFollowingIdList.length > 0) {
      const mutualFollows = await Follow.find({
        follower: { $in: myFollowingIdList },
        following: profileUser.id,
      })
        .populate("follower", "name")
        .limit(4);
      mutualFollowers = mutualFollows.map((f) => {
        const follower = f.follower as unknown as { id: string; name: string };
        return { id: follower.id, name: follower.name };
      });
    }
  }

  return ApiResponse.ok(res, {
    user: { id: profileUser.id, name: profileUser.name, avatar: profileUser.avatar },
    followers,
    following,
    isFollowing: Boolean(isFollowing),
    shelves,
    reviews,
    readingStats: {
      streak: readingStats.streak,
      booksRead: readingStats.booksRead,
      favouriteGenres: readingStats.favouriteGenres,
      genreBreakdown: readingStats.genreBreakdown.slice(0, 5),
      monthlyBooks: readingStats.monthlyBooks.slice(-6),
    },
    badges,
    challengesInProgress,
    clubs: clubs.map((c) => ({ id: c.id, name: c.name })),
    mutualFollowers,
    mutualFollowersCount: mutualFollowers.length,
  });
});

/** Public directory of opt-in profiles — "Find Readers" (§B of
 * community_plan.md). Generalizes the exact privacy filter
 * `followController.getSuggestedUsers` already applies (publicProfile-only,
 * excludes the viewer) from "top 5 suggestions" into a real
 * searchable/sortable/paginated browse page. */
export const getUsersDirectory = asyncHandler(async (req: Request, res: Response) => {
  const { q, genre, sort } = req.query as { q?: string; genre?: string; sort?: string };
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 24));

  const filter: Record<string, unknown> = { publicProfile: true };
  if (req.user) filter._id = { $ne: req.user._id };
  if (q?.trim()) filter.name = { $regex: q.trim(), $options: "i" };
  if (genre?.trim()) filter["preferences.genres"] = genre.trim();

  const total = await User.countDocuments(filter);
  const candidates = await User.find(filter)
    .select("name avatar preferences")
    .skip((page - 1) * limit)
    .limit(limit);

  // Aggregate pipelines run directly against MongoDB with no Mongoose-layer
  // casting, unlike find()/findOne() — pass real ObjectIds (`_id`), not the
  // stringified `id` virtual, or `$in` silently matches nothing.
  const objectIds = candidates.map((c) => c._id);
  const [followerCounts, badgeCounts, myFollowing] = await Promise.all([
    Follow.aggregate([{ $match: { following: { $in: objectIds } } }, { $group: { _id: "$following", count: { $sum: 1 } } }]),
    Badge.aggregate([{ $match: { user: { $in: objectIds } } }, { $group: { _id: "$user", count: { $sum: 1 } } }]),
    req.user
      ? Follow.find({ follower: req.user.id, following: { $in: objectIds } }).select("following")
      : Promise.resolve([]),
  ]);
  const followerCountMap = new Map(followerCounts.map((f) => [f._id.toString(), f.count as number]));
  const badgeCountMap = new Map(badgeCounts.map((b) => [b._id.toString(), b.count as number]));
  const followingSet = new Set((myFollowing as { following: unknown }[]).map((f) => f.following!.toString()));

  let rows = candidates.map((c) => ({
    id: c.id,
    name: c.name,
    avatar: c.avatar,
    topGenre: c.preferences?.genres?.[0] ?? null,
    followers: followerCountMap.get(c.id) ?? 0,
    badgesCount: badgeCountMap.get(c.id) ?? 0,
    isFollowing: followingSet.has(c.id),
  }));

  if (sort === "badges") rows = rows.sort((a, b) => b.badgesCount - a.badgesCount);
  else if (sort === "newest") {
    // already newest-ish via natural Mongo order on a fresh query; explicit
    // no-op branch kept only to document the intent of the `sort` param.
  } else {
    rows = rows.sort((a, b) => b.followers - a.followers);
  }

  return ApiResponse.ok(res, rows, undefined, { page, limit, total, hasMore: page * limit < total });
});
