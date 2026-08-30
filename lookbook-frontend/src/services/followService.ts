import { api } from "./apiClient";
import type { PublicUser, Book } from "../types";

export interface FollowCounts {
  followers: number;
  following: number;
  isFollowing: boolean;
}

export const followUser = (userId: string) => api.post<null>(`/follow/${userId}`);
export const unfollowUser = (userId: string) => api.delete<null>(`/follow/${userId}`);

export const fetchFollowCounts = async (userId: string): Promise<FollowCounts> => {
  const { data } = await api.get<FollowCounts>(`/follow/${userId}/counts`);
  return data;
};

export const fetchFollowers = async (userId: string): Promise<PublicUser[]> => {
  const { data } = await api.get<PublicUser[]>(`/follow/${userId}/followers`);
  return data;
};

export const fetchFollowing = async (userId: string): Promise<PublicUser[]> => {
  const { data } = await api.get<PublicUser[]>(`/follow/${userId}/following`);
  return data;
};

export interface FeedItem {
  type: "review" | "activity";
  user: PublicUser;
  // The referenced book can be null — a review/activity can outlive the
  // book it points to (e.g. an admin later deletes it from the catalog),
  // and Mongoose's populate silently returns null rather than omitting it.
  book: Pick<Book, "id" | "title" | "image"> | null;
  content?: string;
  rating?: number;
  action?: string;
  createdAt: string;
}

export interface FeedPage {
  items: FeedItem[];
  hasMore: boolean;
}

export const fetchFollowingFeed = async (page = 1, limit = 20): Promise<FeedPage> => {
  const { data, meta } = await api.get<FeedItem[]>("/follow/feed", { page, limit });
  return { items: data, hasMore: Boolean(meta?.hasMore) };
};

export interface SuggestedUser {
  id: string;
  name: string;
  avatar?: string;
  reviewCount: number;
}

export const fetchSuggestedUsers = async (): Promise<SuggestedUser[]> => {
  const { data } = await api.get<SuggestedUser[]>("/follow/suggestions");
  return data;
};
