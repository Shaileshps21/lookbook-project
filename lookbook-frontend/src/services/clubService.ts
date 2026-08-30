import { api } from "./apiClient";
import type { Club, ClubInvitePreview } from "../types";

export const fetchClubs = async (): Promise<Club[]> => {
  const { data } = await api.get<Club[]>("/clubs");
  return data;
};

export const fetchClubById = async (id: string): Promise<Club> => {
  const { data } = await api.get<Club>(`/clubs/${id}`);
  return data;
};

export const createClub = async (input: { name: string; description?: string; bookId?: string }): Promise<Club> => {
  const { data } = await api.post<Club>("/clubs", input);
  return data;
};

export const joinClub = async (id: string): Promise<Club> => {
  const { data } = await api.post<Club>(`/clubs/${id}/join`);
  return data;
};

export const leaveClub = async (id: string): Promise<Club> => {
  const { data } = await api.post<Club>(`/clubs/${id}/leave`);
  return data;
};

export const updateClub = async (id: string, input: { name?: string; description?: string }): Promise<Club> => {
  const { data } = await api.patch<Club>(`/clubs/${id}`, input);
  return data;
};

export const removeMember = async (id: string, memberId: string): Promise<Club> => {
  const { data } = await api.delete<Club>(`/clubs/${id}/members/${memberId}`);
  return data;
};

export const deleteClub = (id: string) => api.delete<null>(`/clubs/${id}`);

export const fetchClubByInviteToken = async (token: string): Promise<ClubInvitePreview> => {
  const { data } = await api.get<ClubInvitePreview>(`/clubs/invite/${token}`);
  return data;
};

export const joinByInviteToken = async (token: string): Promise<{ alreadyMember: boolean; club: Club }> => {
  const { data } = await api.post<{ alreadyMember: boolean; club: Club }>(`/clubs/invite/${token}/join`);
  return data;
};

export const regenerateInviteLink = async (clubId: string): Promise<{ inviteToken: string; inviteUrl: string }> => {
  const { data } = await api.post<{ inviteToken: string; inviteUrl: string }>(`/clubs/${clubId}/regenerate-invite`);
  return data;
};

export const toggleInviteEnabled = async (clubId: string, enabled: boolean): Promise<boolean> => {
  const { data } = await api.patch<{ inviteEnabled: boolean }>(`/clubs/${clubId}/invite-enabled`, { enabled });
  return data.inviteEnabled;
};
