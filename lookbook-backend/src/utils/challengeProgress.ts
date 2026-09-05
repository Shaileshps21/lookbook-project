import { UserActivity } from "../models/UserActivity";
import { Book } from "../models/Book";
import type { IChallenge } from "../models/Challenge";

/** Counts distinct books finished in a challenge's period, optionally
 * restricted to a single genre (for `type: "genre"` challenges) — the one
 * extra join a genre-scoped challenge needs beyond the plain "books" count.
 * Shared by challengeController's single-challenge progress check and the
 * batch version below (public profile's "currently working toward" list),
 * so the counting rule exists in exactly one place. */
export const countChallengeProgress = async (
  userId: string,
  challenge: Pick<IChallenge, "id" | "periodStart" | "periodEnd" | "type" | "genre">
): Promise<number> => {
  const activities = await UserActivity.find({
    user: userId,
    action: "finished",
    createdAt: { $gte: challenge.periodStart, $lte: challenge.periodEnd },
  }).select("book");

  if (challenge.type !== "genre" || !challenge.genre) {
    return new Set(activities.map((a) => a.book.toString())).size;
  }

  const bookIds = [...new Set(activities.map((a) => a.book.toString()))];
  if (bookIds.length === 0) return 0;
  return Book.countDocuments({ _id: { $in: bookIds }, category: challenge.genre });
};

export const computeChallengeProgressBatch = async (
  userId: string,
  challenges: (Pick<IChallenge, "id" | "title" | "target" | "periodStart" | "periodEnd" | "type" | "genre">)[]
): Promise<{ id: string; title: string; target: number; progress: number }[]> => {
  return Promise.all(
    challenges.map(async (c) => ({
      id: c.id,
      title: c.title,
      target: c.target,
      progress: await countChallengeProgress(userId, c),
    }))
  );
};
