import { api } from "./apiClient";
import type { Challenge, ChallengeProgress, Badge, LeaderboardRow } from "../types";

export const fetchChallenges = async (): Promise<Challenge[]> => {
  const { data } = await api.get<Challenge[]>("/challenges");
  return data;
};

export const fetchChallengeProgress = async (challengeId: string): Promise<ChallengeProgress> => {
  const { data } = await api.get<ChallengeProgress>(`/challenges/${challengeId}/progress`);
  return data;
};

export const fetchLeaderboard = async (challengeId: string): Promise<LeaderboardRow[]> => {
  const { data } = await api.get<LeaderboardRow[]>(`/challenges/${challengeId}/leaderboard`);
  return data;
};

export const fetchMyBadges = async (): Promise<Badge[]> => {
  const { data } = await api.get<Badge[]>("/challenges/badges/mine");
  return data;
};
