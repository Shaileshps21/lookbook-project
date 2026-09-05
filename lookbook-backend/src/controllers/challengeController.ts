import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { Challenge, type ChallengeType } from "../models/Challenge";
import { ChallengeParticipant } from "../models/ChallengeParticipant";
import { Badge } from "../models/Badge";
import { Club } from "../models/Club";
import { UserActivity } from "../models/UserActivity";
import { getCache } from "../config/redis";
import { leaderboardCacheKey } from "../queues/leaderboardQueue";
import { notify } from "../utils/notify";
import { countChallengeProgress } from "../utils/challengeProgress";

export const getChallenges = asyncHandler(async (req: Request, res: Response) => {
  const { clubId } = req.query as { clubId?: string };
  const filter: Record<string, unknown> = { active: true };
  if (clubId) filter.club = clubId;

  const challenges = await Challenge.find(filter).populate("club", "name").populate("createdBy", "name").sort("-periodStart");

  let joinedIds = new Set<string>();
  if (req.user) {
    const mine = await ChallengeParticipant.find({ user: req.user.id }).select("challenge");
    joinedIds = new Set(mine.map((m) => m.challenge.toString()));
  }

  return ApiResponse.ok(
    res,
    challenges.map((c) => ({ ...c.toJSON(), joined: joinedIds.has(c.id) }))
  );
});

export const createChallenge = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { title, description, type, genre, target, periodStart, periodEnd, clubId, official } = req.body as {
    title: string;
    description?: string;
    type?: ChallengeType;
    genre?: string;
    target: number;
    periodStart: string;
    periodEnd: string;
    clubId?: string;
    official?: boolean;
  };

  if (!title?.trim() || !target || !periodStart || !periodEnd) {
    throw ApiError.badRequest("title, target, periodStart, and periodEnd are required.");
  }
  if (new Date(periodEnd) <= new Date(periodStart)) {
    throw ApiError.badRequest("periodEnd must be after periodStart.");
  }
  if (type === "genre" && !genre?.trim()) {
    throw ApiError.badRequest("genre is required for a genre-type challenge.");
  }

  // Club-scoped challenges can only be created by a member of that club —
  // anyone could otherwise post a "challenge" onto a club they have nothing
  // to do with.
  if (clubId) {
    const club = await Club.findById(clubId);
    if (!club) throw ApiError.notFound("Club not found");
    if (!club.members.some((m) => m.toString() === req.user!.id)) {
      throw ApiError.forbidden("You must be a member of this club to create a challenge for it.");
    }
  }

  const challenge = await Challenge.create({
    title: title.trim(),
    description: description?.trim() ?? "",
    type: type ?? "books",
    genre: type === "genre" ? genre?.trim() : undefined,
    target,
    periodStart: new Date(periodStart),
    periodEnd: new Date(periodEnd),
    createdBy: req.user.id,
    club: clubId || undefined,
    // "Official" is only ever settable by an admin — a normal user's create
    // request silently drops the flag rather than erroring, since the field
    // is opt-in decoration, not something a request needs to know it can't have.
    official: req.user.role === "admin" ? Boolean(official) : false,
  });
  await challenge.populate("club", "name");
  await challenge.populate("createdBy", "name");

  return ApiResponse.created(res, { ...challenge.toJSON(), joined: false }, "Challenge created");
});

export const joinChallenge = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const challenge = await Challenge.findById(req.params.challengeId);
  if (!challenge) throw ApiError.notFound("Challenge not found");

  const existing = await ChallengeParticipant.findOne({ user: req.user.id, challenge: challenge.id });
  if (existing) {
    return ApiResponse.ok(res, { joined: true }, "Already joined");
  }

  await ChallengeParticipant.create({ user: req.user.id, challenge: challenge.id });
  challenge.participantsCount += 1;
  await challenge.save();

  if (challenge.createdBy.toString() !== req.user.id) {
    notify(
      challenge.createdBy.toString(),
      "community.challengeJoined",
      "Someone joined your challenge",
      `${req.user.name} joined "${challenge.title}"`,
      "/challenges"
    );
  }

  return ApiResponse.ok(res, { joined: true }, "Joined challenge");
});

export const leaveChallenge = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const challenge = await Challenge.findById(req.params.challengeId);
  if (!challenge) throw ApiError.notFound("Challenge not found");

  const removed = await ChallengeParticipant.findOneAndDelete({ user: req.user.id, challenge: challenge.id });
  if (removed) {
    challenge.participantsCount = Math.max(0, challenge.participantsCount - 1);
    await challenge.save();
  }

  return ApiResponse.ok(res, { joined: false }, "Left challenge");
});

/** Computes progress and lazily awards the badge the first time target is
 * reached. Checking progress is an unambiguous "I'm doing this" signal, so
 * the first call also auto-joins — an extra confirmation click before you're
 * even allowed to see your own progress would just be friction. */
export const getMyChallengeProgress = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const challenge = await Challenge.findById(req.params.challengeId);
  if (!challenge) throw ApiError.notFound("Challenge not found");

  let participant = await ChallengeParticipant.findOne({ user: req.user.id, challenge: challenge.id });
  if (!participant) {
    participant = await ChallengeParticipant.create({ user: req.user.id, challenge: challenge.id });
    challenge.participantsCount += 1;
    await challenge.save();
  }

  const progress = await countChallengeProgress(req.user.id, challenge);

  let badge = await Badge.findOne({ user: req.user.id, challenge: challenge.id });
  const alreadyCompleted = Boolean(badge);
  if (!badge && progress >= challenge.target) {
    badge = await Badge.create({ user: req.user.id, challenge: challenge.id, title: challenge.title });
    if (!alreadyCompleted) {
      notify(
        req.user.id,
        "community.challengeCompleted",
        "Challenge completed!",
        `You completed "${challenge.title}" — badge earned.`,
        "/challenges"
      );
    }
  }

  return ApiResponse.ok(res, {
    progress,
    target: challenge.target,
    completed: Boolean(badge),
    justCompleted: !alreadyCompleted && Boolean(badge),
    awardedAt: badge?.awardedAt ?? null,
  });
});

export const getMyBadges = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const badges = await Badge.find({ user: req.user.id }).populate("challenge", "title description").sort("-awardedAt");
  return ApiResponse.ok(res, badges);
});

/** Joined + active/completed split, backing the "My Challenges" tab. */
export const getMyChallenges = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const participations = await ChallengeParticipant.find({ user: req.user.id }).select("challenge");
  const challengeIds = participations.map((p) => p.challenge);
  const [challenges, badges] = await Promise.all([
    Challenge.find({ _id: { $in: challengeIds } })
      .populate("club", "name")
      .sort("-periodStart"),
    Badge.find({ user: req.user.id, challenge: { $in: challengeIds } }).select("challenge awardedAt"),
  ]);

  const completedMap = new Map(badges.map((b) => [b.challenge.toString(), b.awardedAt]));
  const active = challenges.filter((c) => !completedMap.has(c.id));
  const completed = challenges.filter((c) => completedMap.has(c.id));

  return ApiResponse.ok(res, {
    active: active.map((c) => ({ ...c.toJSON(), joined: true })),
    completed: completed.map((c) => ({ ...c.toJSON(), joined: true, awardedAt: completedMap.get(c.id) })),
  });
});

/**
 * Backed by a BullMQ job (see queues/leaderboardQueue.ts) that recomputes
 * and caches every active challenge's leaderboard every 30 minutes — this
 * just serves the cached copy. Falls back to a live aggregation on a cache
 * miss (Redis unavailable, or the worker hasn't ticked yet), so behavior
 * degrades gracefully rather than depending on the queue being up.
 *
 * Restricted to joined participants only (previously every "finished"
 * activity from anyone counted, whether or not that person had ever heard
 * of the challenge) — plus the viewer's own row even when it falls outside
 * the top 20, since silently not appearing reads as broken, not "you're
 * unranked."
 */
export const getLeaderboard = asyncHandler(async (req: Request, res: Response) => {
  const challenge = await Challenge.findById(req.params.challengeId);
  if (!challenge) throw ApiError.notFound("Challenge not found");

  const participants = await ChallengeParticipant.find({ challenge: challenge.id }).select("user");
  const participantIds = participants.map((p) => p.user);

  type RawRow = { userId: string; name: string; avatar?: string; booksFinished: number };
  let rows: RawRow[];
  const cached = await getCache<RawRow[]>(leaderboardCacheKey(challenge.id));
  if (cached) {
    rows = cached;
  } else if (participantIds.length > 0) {
    rows = await UserActivity.aggregate([
      {
        $match: {
          user: { $in: participantIds },
          action: "finished",
          createdAt: { $gte: challenge.periodStart, $lte: challenge.periodEnd },
        },
      },
      { $group: { _id: { user: "$user", book: "$book" } } },
      { $group: { _id: "$_id.user", booksFinished: { $sum: 1 } } },
      { $sort: { booksFinished: -1 } },
      { $limit: 100 },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      { $project: { _id: 0, userId: "$_id", name: "$user.name", avatar: "$user.avatar", booksFinished: 1 } },
    ]);
  } else {
    rows = [];
  }

  const ranked = rows.map((r, i) => ({ ...r, rank: i + 1 }));
  const top = ranked.slice(0, 20);

  let viewerRank: (typeof ranked)[number] | null = null;
  if (req.user) {
    viewerRank = ranked.find((r) => r.userId === req.user!.id) ?? null;
    if (!viewerRank && participantIds.some((id) => id.toString() === req.user!.id)) {
      // Joined but hasn't finished a qualifying book yet — still show them,
      // rank "unranked" rather than omitting them entirely.
      viewerRank = { userId: req.user.id, name: req.user.name, avatar: req.user.avatar, booksFinished: 0, rank: 0 };
    }
  }

  return ApiResponse.ok(res, { rows: top, viewerRank, totalParticipants: participantIds.length });
});
