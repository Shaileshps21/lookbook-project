import { api } from "./apiClient";
import type { Book, CartItem, CartMode } from "../types";

interface RawCartItem {
  book: Book;
  mode: CartMode;
  quantity: number;
}

export const fetchServerCart = async (): Promise<CartItem[]> => {
  const { data } = await api.get<{ items: RawCartItem[] }>("/cart");
  return data.items;
};

export const addServerCartItem = async (bookId: string, mode: CartMode): Promise<CartItem[]> => {
  const { data } = await api.post<RawCartItem[]>("/cart", { bookId, mode });
  return data;
};

export const updateServerCartItem = async (
  bookId: string,
  mode: CartMode,
  quantity: number
): Promise<CartItem[]> => {
  const { data } = await api.patch<RawCartItem[]>(`/cart/${bookId}/${mode}`, { quantity });
  return data;
};

export const removeServerCartItem = async (bookId: string, mode: CartMode): Promise<CartItem[]> => {
  const { data } = await api.delete<RawCartItem[]>(`/cart/${bookId}/${mode}`);
  return data;
};

export const clearServerCart = async (): Promise<void> => {
  await api.delete<RawCartItem[]>("/cart");
};
