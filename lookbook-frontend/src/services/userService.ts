import { api } from "./apiClient";
import type { UserPreferences, SellerApplication, PublicProfile, User, EmailPreferences, DirectoryUser } from "../types";

export interface UpdatePreferencesInput {
  genres: string[];
  authors: string[];
  readingGoal?: number;
  language?: string;
}

export const updatePreferences = async (input: UpdatePreferencesInput): Promise<UserPreferences> => {
  const { data } = await api.patch<{ preferences: UserPreferences }>("/users/preferences", input);
  return data.preferences;
};

export const skipOnboarding = async (): Promise<UserPreferences> => {
  const { data } = await api.post<{ preferences: UserPreferences }>("/users/preferences/skip");
  return data.preferences;
};

export const applyToSell = async (): Promise<SellerApplication> => {
  const { data } = await api.post<{ sellerApplication: SellerApplication }>("/users/apply-seller");
  return data.sellerApplication;
};

export const updatePublicProfileSetting = async (publicProfile: boolean): Promise<boolean> => {
  const { data } = await api.patch<{ publicProfile: boolean }>("/users/public-profile", { publicProfile });
  return data.publicProfile;
};

export const fetchPublicProfile = async (userId: string): Promise<PublicProfile> => {
  const { data } = await api.get<PublicProfile>(`/users/${userId}/public-profile`);
  return data;
};

export const fetchMyStats = async (): Promise<{ reviewsCount: number }> => {
  const { data } = await api.get<{ reviewsCount: number }>("/users/me/stats");
  return data;
};

export const updateMe = async (input: { name?: string; avatar?: string }): Promise<User> => {
  const { data } = await api.patch<{ user: User }>("/users/me", input);
  return data.user;
};

export const updateEmailPreferences = async (input: Partial<EmailPreferences>): Promise<EmailPreferences> => {
  const { data } = await api.patch<{ emailPreferences: EmailPreferences }>("/users/me/email-preferences", input);
  return data.emailPreferences;
};

export interface DirectoryPage {
  users: DirectoryUser[];
  hasMore: boolean;
  total: number;
}

export const fetchUsersDirectory = async (params: {
  q?: string;
  genre?: string;
  sort?: "followers" | "badges" | "newest";
  page?: number;
  limit?: number;
}): Promise<DirectoryPage> => {
  const { data, meta } = await api.get<DirectoryUser[]>("/users/directory", {
    q: params.q,
    genre: params.genre,
    sort: params.sort,
    page: params.page,
    limit: params.limit,
  });
  return { users: data, hasMore: Boolean(meta?.hasMore), total: Number(meta?.total ?? data.length) };
};
