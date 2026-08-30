import { api } from "./apiClient";
import type { Homepage } from "../types";

export const fetchHomepage = async (): Promise<Homepage> => {
  const { data } = await api.get<Homepage>("/homepage");
  return data;
};
