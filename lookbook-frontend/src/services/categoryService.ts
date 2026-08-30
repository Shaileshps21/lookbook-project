import { api } from "./apiClient";
import type { Category } from "../types";

export const fetchCategories = async (): Promise<Category[]> => {
  const { data } = await api.get<Category[]>("/categories");
  return data;
};

export const fetchCategoryNames = async (): Promise<string[]> => {
  const categories = await fetchCategories();
  return ["All", ...categories.map((c) => c.name)];
};
