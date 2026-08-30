import { api } from "./apiClient";
import type { Shelf, ShelfVisibility } from "../types";

export const fetchMyShelves = async (): Promise<Shelf[]> => {
  const { data } = await api.get<Shelf[]>("/shelves");
  return data;
};

export const createShelf = async (name: string, visibility: ShelfVisibility): Promise<Shelf> => {
  const { data } = await api.post<Shelf>("/shelves", { name, visibility });
  return data;
};

export const updateShelf = async (shelfId: string, updates: { name?: string; visibility?: ShelfVisibility }): Promise<Shelf> => {
  const { data } = await api.patch<Shelf>(`/shelves/${shelfId}`, updates);
  return data;
};

export const deleteShelf = (shelfId: string) => api.delete<null>(`/shelves/${shelfId}`);

export const addBookToShelf = async (shelfId: string, bookId: string): Promise<Shelf> => {
  const { data } = await api.post<Shelf>(`/shelves/${shelfId}/books/${bookId}`);
  return data;
};

export const removeBookFromShelf = async (shelfId: string, bookId: string): Promise<Shelf> => {
  const { data } = await api.delete<Shelf>(`/shelves/${shelfId}/books/${bookId}`);
  return data;
};

export const fetchPublicShelves = async (userId: string): Promise<Shelf[]> => {
  const { data } = await api.get<Shelf[]>(`/shelves/user/${userId}`);
  return data;
};
