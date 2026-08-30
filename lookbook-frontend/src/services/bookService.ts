import { api } from "./apiClient";
import type { Book } from "../types";

export interface BookListParams {
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "popular" | "price-asc" | "price-desc" | "rating" | "newest";
  page?: number;
  limit?: number;
}

export interface BookListResult {
  books: Book[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const fetchBooks = async (params: BookListParams = {}): Promise<BookListResult> => {
  const { data, meta } = await api.get<Book[]>("/books", {
    search: params.search,
    category: params.category && params.category !== "All" ? params.category : undefined,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    sort: params.sort,
    page: params.page,
    limit: params.limit,
  });

  return {
    books: data,
    page: Number(meta?.page ?? 1),
    limit: Number(meta?.limit ?? data.length),
    total: Number(meta?.total ?? data.length),
    totalPages: Number(meta?.totalPages ?? 1),
  };
};

export const fetchBookById = async (id: string): Promise<Book> => {
  const { data } = await api.get<Book>(`/books/${id}`);
  return data;
};

export const fetchSimilarBooks = async (id: string): Promise<Book[]> => {
  const { data } = await api.get<Book[]>(`/books/${id}/similar`);
  return data;
};

export interface AiSearchResult {
  results: Book[];
  interpretedAs: { category?: string; maxPrice?: number; minRating?: number; keywords: string[] } | null;
}

export const aiSearchBooks = async (query: string): Promise<AiSearchResult> => {
  const { data } = await api.get<AiSearchResult>("/books/ai-search", { q: query });
  return data;
};

export interface IsbnLookupResult {
  source: "catalog" | "open-library";
  alreadyInCatalog: boolean;
  title: string;
  author: string;
  isbn: string;
  publisher?: string;
  published?: string;
  pages?: number;
  image?: string;
  category?: string;
  catalogBookId?: string;
  subjects?: string[];
}

export const lookupBookByIsbn = async (isbn: string): Promise<IsbnLookupResult> => {
  const { data } = await api.get<IsbnLookupResult>(`/books/by-isbn/${encodeURIComponent(isbn)}`);
  return data;
};
