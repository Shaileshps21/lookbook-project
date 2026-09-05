import { Queue, Worker, type Job } from "bullmq";
import { Challenge } from "../models/Challenge";
import { ChallengeParticipant } from "../models/ChallengeParticipant";
import { UserActivity } from "../models/UserActivity";
import { setCache } from "../config/redis";
import { createQueueConnection, createWorkerConnection, queuesEnabled, attachQueueErrorHandler } from "./connection";

const QUEUE_NAME = "leaderboard-refresh";
const REPEAT_EVERY_MS = 30 * 60 * 1000; // every 30 minutes
const CACHE_TTL_SECONDS = 40 * 60; // outlives the repeat interval so a slow tick never leaves a gap
// A tick aggregates every active challenge; keep the job lock well clear of
// the default 30s in case that ever runs long.
const LOCK_DURATION_MS = 5 * 60 * 1000;

export const leaderboardCacheKey = (challengeId: string): string => `leaderboard:${challengeId}`;

export const leaderboardQueue = queuesEnabled
  ? new Queue(QUEUE_NAME, { connection: createQueueConnection() })
  : null;

if (leaderboardQueue) attachQueueErrorHandler(leaderboardQueue, "leaderboard");

/** Recomputes and caches the leaderboard for every active challenge — the same
 * aggregation getLeaderboard() runs on a cache miss, just done proactively.
 * Restricted to that challenge's joined participants (matching the live
 * controller path) so the cached leaderboard doesn't quietly rank people who
 * never joined the challenge. */
const refreshAllLeaderboards = async (): Promise<void> => {
  const challenges = await Challenge.find({ active: true });

  for (const challenge of challenges) {
    const participants = await ChallengeParticipant.find({ challenge: challenge.id }).select("user");
    const participantIds = participants.map((p) => p.user);

    if (participantIds.length === 0) {
      await setCache(leaderboardCacheKey(challenge.id), [], CACHE_TTL_SECONDS);
      continue;
    }

    const genreStage =
      challenge.type === "genre" && challenge.genre
        ? [
            { $lookup: { from: "books", localField: "book", foreignField: "_id", as: "bookDoc" } },
            { $unwind: "$bookDoc" },
            { $match: { "bookDoc.category": challenge.genre } },
          ]
        : [];

    const rows = await UserActivity.aggregate([
      {
        $match: {
          user: { $in: participantIds },
          action: "finished",
          createdAt: { $gte: challenge.periodStart, $lte: challenge.periodEnd },
        },
      },
      ...genreStage,
      { $group: { _id: { user: "$user", book: "$book" } } },
      { $group: { _id: "$_id.user", booksFinished: { $sum: 1 } } },
      { $sort: { booksFinished: -1 } },
      { $limit: 100 },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      { $project: { _id: 0, userId: "$_id", name: "$user.name", avatar: "$user.avatar", booksFinished: 1 } },
    ]);

    await setCache(leaderboardCacheKey(challenge.id), rows, CACHE_TTL_SECONDS);
  }
};

export const startLeaderboardWorker = (): void => {
  if (!queuesEnabled || !leaderboardQueue) return;

  const worker = new Worker(
    QUEUE_NAME,
    async (_job: Job) => {
      await refreshAllLeaderboards();
    },
    { connection: createWorkerConnection(), lockDuration: LOCK_DURATION_MS }
  );
  attachQueueErrorHandler(worker, "leaderboard");

  leaderboardQueue
    .add(
      "refresh",
      {},
      {
        repeat: { every: REPEAT_EVERY_MS },
        jobId: "leaderboard-refresh-repeat",
      }
    )
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[queues] Failed to schedule leaderboard refresh:", err);
    });
};
