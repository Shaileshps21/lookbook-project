import { api } from "./apiClient";
import type { ReadingStats, SustainabilityStats } from "../types";

export const fetchReadingStats = async (): Promise<ReadingStats> => {
  const { data } = await api.get<ReadingStats>("/reading/stats");
  return data;
};

export const fetchSustainabilityStats = async (): Promise<SustainabilityStats> => {
  const { data } = await api.get<SustainabilityStats>("/reading/sustainability");
  return data;
};

export const markBookFinished = (bookId: string) => api.post<null>(`/reading/finish/${bookId}`);
