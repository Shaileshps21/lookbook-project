import { api } from "./apiClient";
import type { Plan } from "../types";

export const fetchPlans = async (): Promise<Plan[]> => {
  const { data } = await api.get<Plan[]>("/plans");
  return data;
};
