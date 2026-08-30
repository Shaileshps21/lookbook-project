import { api } from "./apiClient";
import type { Review } from "../types";

interface RawReview extends Omit<Review, "date" | "bookId"> {
  book: string;
  createdAt: string;
}

const mapReview = (raw: RawReview): Review => ({
  id: raw.id,
  bookId: raw.book,
  name: raw.name,
  rating: raw.rating,
  comment: raw.comment,
  verifiedReader: raw.verifiedReader,
  date: new Date(raw.createdAt).toLocaleDateString("en-IN", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }),
});

export const fetchReviews = async (bookId: string): Promise<Review[]> => {
  const { data } = await api.get<RawReview[]>(`/books/${bookId}/reviews`);
  return data.map(mapReview);
};

export const submitReview = async (
  bookId: string,
  rating: number,
  comment: string
): Promise<Review> => {
  const { data } = await api.post<RawReview>(`/books/${bookId}/reviews`, { rating, comment });
  return mapReview(data);
};
