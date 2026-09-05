import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { Follow } from "../models/Follow";
import { Review } from "../models/Review";
import { User } from "../models/User";
import { UserActivity } from "../models/UserActivity";
import { notify } from "../utils/notify";

export const followUser = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { userId } = req.params;
  if (userId === req.user.id) throw ApiError.badRequest("You can't follow yourself.");

  const target = await User.findById(userId);
  if (!target) throw ApiError.notFound("User not found");

  const alreadyFollowing = await Follow.exists({ follower: req.user.id, following: userId });

  await Follow.findOneAndUpdate(
    { follower: req.user.id, following: userId },
    { follower: req.user.id, following: userId },
    { upsert: true }
  );

  // Only notify on a genuinely new follow — the upsert above is otherwise a
  // harmless no-op on a repeat call, and shouldn't spam a duplicate notification.
  if (!alreadyFollowing) {
    notify(userId, "community.follow", "New follower", `${req.user.name} started following you.`, `/u/${req.user.id}`);
  }

  return ApiResponse.ok(res, null, "Followed");
});

export const unfollowUser = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { userId } = req.params;
  await Follow.deleteOne({ follower: req.user.id, following: userId });

  return ApiResponse.ok(res, null, "Unfollowed");
});

/** The mirror of unfollow — removes someone *following you* rather than
 * someone you follow. Follow has no concept of mutual consent (anyone can
 * follow anyone with a public-enough profile), so this is the only lever a
 * user has over who shows up in their own followers list. */
export const removeFollower = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { userId } = req.params;
  await Follow.deleteOne({ follower: userId, following: req.user.id });

  return ApiResponse.ok(res, null, "Removed");
});

export const getFollowCounts = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  const [followers, following, isFollowing] = await Promise.all([
    Follow.countDocuments({ following: userId }),
    Follow.countDocuments({ follower: userId }),
    req.user ? Follow.exists({ follower: req.user.id, following: userId }) : Promise.resolve(null),
  ]);

  return ApiResponse.ok(res, { followers, following, isFollowing: Boolean(isFollowing) });
});

export const getFollowers = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const follows = await Follow.find({ following: userId }).populate("follower", "name avatar publicProfile");
  return ApiResponse.ok(
    res,
    follows.map((f) => f.follower)
  );
});

export const getFollowing = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const follows = await Follow.find({ follower: userId }).populate("following", "name avatar publicProfile");
  return ApiResponse.ok(
    res,
    follows.map((f) => f.following)
  );
});

/** Unified feed of recent reviews and "finished" activity from users the
 * current user follows — a minimal Goodreads-style reading-circle feed
 * (future.md Feature 7). Merges two differently-shaped collections by
 * fetching a bounded window from each (large enough to cover the requested
 * page) rather than a single cross-collection query Mongo can't express. */
export const getFollowingFeed = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const windowSize = page * limit;

  const follows = await Follow.find({ follower: req.user.id }).select("following");
  const followingIds = follows.map((f) => f.following);

  if (followingIds.length === 0) {
    return ApiResponse.ok(res, [], undefined, { page, limit, hasMore: false });
  }

  const [reviews, activities] = await Promise.all([
    Review.find({ user: { $in: followingIds } })
      .sort("-createdAt")
      .limit(windowSize)
      .populate("book", "title image author")
      .populate("user", "name avatar"),
    UserActivity.find({ user: { $in: followingIds }, action: "finished" })
      .sort("-createdAt")
      .limit(windowSize)
      .populate("book", "title image author")
      .populate("user", "name avatar"),
  ]);

  const feedItems = [
    ...reviews.map((r) => ({
      type: "review" as const,
      user: r.user,
      book: r.book,
      content: r.comment,
      rating: r.rating,
      createdAt: r.createdAt,
    })),
    ...activities.map((a) => ({
      type: "activity" as const,
      user: a.user,
      book: a.book,
      action: a.action,
      createdAt: a.createdAt,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const start = (page - 1) * limit;
  const pageItems = feedItems.slice(start, start + limit);
  const hasMore = feedItems.length > start + limit;

  return ApiResponse.ok(res, pageItems, undefined, { page, limit, hasMore });
});

/** "Who to follow" suggestions — the most-reviewing users the current user
 * doesn't already follow, restricted to public profiles only. */
export const getSuggestedUsers = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const follows = await Follow.find({ follower: req.user.id }).select("following");
  const excludedIds = [...follows.map((f) => f.following.toString()), req.user.id];

  const topReviewers = await Review.aggregate([
    { $group: { _id: "$user", reviewCount: { $sum: 1 } } },
    { $sort: { reviewCount: -1 } },
    { $limit: 25 },
  ]);

  const candidateIds = topReviewers
    .map((r) => r._id.toString())
    .filter((id) => !excludedIds.includes(id));

  const users = await User.find({ _id: { $in: candidateIds }, publicProfile: true }).select("name avatar");
  const countById = new Map(topReviewers.map((r) => [r._id.toString(), r.reviewCount as number]));

  const suggestions = users
    .map((u) => ({ id: u.id, name: u.name, avatar: u.avatar, reviewCount: countById.get(u.id) ?? 0 }))
    .sort((a, b) => b.reviewCount - a.reviewCount)
    .slice(0, 5);

  return ApiResponse.ok(res, suggestions);
});
