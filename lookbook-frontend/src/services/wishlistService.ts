import { api } from "./apiClient";
import type { Book } from "../types";

export const fetchServerWishlist = async (): Promise<Book[]> => {
  const { data } = await api.get<Book[]>("/wishlist");
  return data;
};

export const toggleServerWishlist = async (bookId: string): Promise<Book[]> => {
  const { data } = await api.post<Book[]>(`/wishlist/${bookId}`);
  return data;
};

export const removeServerWishlistItem = async (bookId: string): Promise<Book[]> => {
  const { data } = await api.delete<Book[]>(`/wishlist/${bookId}`);
  return data;
};
