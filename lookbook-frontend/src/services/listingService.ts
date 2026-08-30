import { api, ApiClientError, getAccessToken } from "./apiClient";
import type { Listing, ListingCondition } from "../types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export interface CreateListingInput {
  title: string;
  author: string;
  category: string;
  price: number;
  condition: ListingCondition;
  description?: string;
  images?: string[];
}

export const createListing = async (input: CreateListingInput): Promise<Listing> => {
  const { data } = await api.post<Listing>("/listings", input);
  return data;
};

export const fetchMyListings = async (): Promise<Listing[]> => {
  const { data } = await api.get<Listing[]>("/listings/mine");
  return data;
};

export const deleteListingRequest = (id: string) => api.delete<null>(`/listings/${id}`);

export interface BookScanResult {
  title: string;
  author: string;
  isbn?: string;
  publisher?: string;
  published?: string;
  language: string;
  category?: string;
  pages?: number;
  suggestedRentPrice: number;
  suggestedBuyPrice: number;
  demandScore: number;
  alreadyInCatalog: boolean;
  matchingBookId?: string;
}

export interface PricePrediction {
  suggestedRentPrice: number;
  suggestedBuyPrice: number;
  demandScore: number;
  reasoning: string;
}

export const scanBookCover = async (image: File): Promise<BookScanResult> => {
  const form = new FormData();
  form.append("image", image);
  const res = await fetch(`${API_URL}/listings/scan`, {
    method: "POST",
    credentials: "include",
    headers: { Authorization: `Bearer ${getAccessToken()}` },
    body: form,
  });
  if (!res.ok) throw new ApiClientError(res.status, "We couldn't scan that image. Try a clearer photo.");
  const payload = await res.json();
  return payload.data as BookScanResult;
};

export const suggestListingPrice = async (input: {
  title: string;
  author?: string;
  category?: string;
  pages?: number;
}): Promise<PricePrediction> => {
  const { data } = await api.post<PricePrediction>("/listings/scan-price", input);
  return data;
};
