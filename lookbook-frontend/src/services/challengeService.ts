import { api } from "./apiClient";
import type { Challenge, ChallengeProgress, Badge, LeaderboardData, MyChallenges, ChallengeType } from "../types";

export const fetchChallenges = async (clubId?: string): Promise<Challenge[]> => {
  const { data } = await api.get<Challenge[]>("/challenges", clubId ? { clubId } : undefined);
  return data;
};

export const fetchMyChallenges = async (): Promise<MyChallenges> => {
  const { data } = await api.get<MyChallenges>("/challenges/mine");
  return data;
};

export interface CreateChallengeInput {
  title: string;
  description?: string;
  type: ChallengeType;
  genre?: string;
  target: number;
  periodStart: string;
  periodEnd: string;
  clubId?: string;
  official?: boolean;
}

export const createChallenge = async (input: CreateChallengeInput): Promise<Challenge> => {
  const { data } = await api.post<Challenge>("/challenges", input);
  return data;
};

export const joinChallenge = (challengeId: string) => api.post<{ joined: boolean }>(`/challenges/${challengeId}/join`);
export const leaveChallenge = (challengeId: string) => api.delete<{ joined: boolean }>(`/challenges/${challengeId}/join`);

export const fetchChallengeProgress = async (challengeId: string): Promise<ChallengeProgress> => {
  const { data } = await api.get<ChallengeProgress>(`/challenges/${challengeId}/progress`);
  return data;
};

export const fetchLeaderboard = async (challengeId: string): Promise<LeaderboardData> => {
  const { data } = await api.get<LeaderboardData>(`/challenges/${challengeId}/leaderboard`);
  return data;
};

export const fetchMyBadges = async (): Promise<Badge[]> => {
  const { data } = await api.get<Badge[]>("/challenges/badges/mine");
  return data;
};
