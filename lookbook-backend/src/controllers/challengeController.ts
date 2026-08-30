import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { Challenge } from "../models/Challenge";
import { Badge } from "../models/Badge";
import { UserActivity } from "../models/UserActivity";
import { getCache } from "../config/redis";
import { leaderboardCacheKey } from "../queues/leaderboardQueue";

export const getChallenges = asyncHandler(async (_req: Request, res: Response) => {
  const challenges = await Challenge.find({ active: true }).sort("-periodStart");
  return ApiResponse.ok(res, challenges);
});

export const createChallenge = asyncHandler(async (req: Request, res: Response) => {
  const { title, description, target, periodStart, periodEnd } = req.body as {
    title: string;
    description?: string;
    target: number;
    periodStart: string;
    periodEnd: string;
  };

  if (!title?.trim() || !target || !periodStart || !periodEnd) {
    throw ApiError.badRequest("title, target, periodStart, and periodEnd are required.");
  }

  const challenge = await Challenge.create({
    title: title.trim(),
    description: description?.trim() ?? "",
    target,
    periodStart: new Date(periodStart),
    periodEnd: new Date(periodEnd),
  });

  return ApiResponse.created(res, challenge, "Challenge created");
});

const countDistinctBooksFinished = async (userId: string, periodStart: Date, periodEnd: Date) => {
  const activities = await UserActivity.find({
    user: userId,
    action: "finished",
    createdAt: { $gte: periodStart, $lte: periodEnd },
  }).select("book");
  return new Set(activities.map((a) => a.book.toString())).size;
};

/** Computes progress and lazily awards the badge the first time target is reached. */
export const getMyChallengeProgress = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const challenge = await Challenge.findById(req.params.challengeId);
  if (!challenge) throw ApiError.notFound("Challenge not found");

  const progress = await countDistinctBooksFinished(req.user.id, challenge.periodStart, challenge.periodEnd);

  let badge = await Badge.findOne({ user: req.user.id, challenge: challenge.id });
  if (!badge && progress >= challenge.target) {
    badge = await Badge.create({ user: req.user.id, challenge: challenge.id, title: challenge.title });
  }

  return ApiResponse.ok(res, {
    progress,
    target: challenge.target,
    completed: Boolean(badge),
    awardedAt: badge?.awardedAt ?? null,
  });
});

export const getMyBadges = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const badges = await Badge.find({ user: req.user.id }).populate("challenge", "title description").sort("-awardedAt");
  return ApiResponse.ok(res, badges);
});

/**
 * Backed by a BullMQ job (see queues/leaderboardQueue.ts) that recomputes
 * and caches every active challenge's leaderboard every 30 minutes — this
 * just serves the cached copy. Falls back to a live aggregation on a cache
 * miss (Redis unavailable, or the worker hasn't ticked yet), so behavior
 * degrades gracefully rather than depending on the queue being up.
 */
export const getLeaderboard = asyncHandler(async (req: Request, res: Response) => {
  const challenge = await Challenge.findById(req.params.challengeId);
  if (!challenge) throw ApiError.notFound("Challenge not found");

  const cached = await getCache(leaderboardCacheKey(challenge.id));
  if (cached) return ApiResponse.ok(res, cached);

  const rows = await UserActivity.aggregate([
    {
      $match: {
        action: "finished",
        createdAt: { $gte: challenge.periodStart, $lte: challenge.periodEnd },
      },
    },
    { $group: { _id: { user: "$user", book: "$book" } } },
    { $group: { _id: "$_id.user", booksFinished: { $sum: 1 } } },
    { $sort: { booksFinished: -1 } },
    { $limit: 20 },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $project: {
        _id: 0,
        userId: "$_id",
        name: "$user.name",
        avatar: "$user.avatar",
        booksFinished: 1,
      },
    },
  ]);

  return ApiResponse.ok(res, rows);
});
