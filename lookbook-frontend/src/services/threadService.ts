import { api } from "./apiClient";
import type { Thread, Comment } from "../types";

export const fetchThreadsForClub = async (clubId: string): Promise<Thread[]> => {
  const { data } = await api.get<Thread[]>(`/threads/club/${clubId}`);
  return data;
};

export const fetchThreadsForBook = async (bookId: string): Promise<Thread[]> => {
  const { data } = await api.get<Thread[]>(`/threads/book/${bookId}`);
  return data;
};

export const createThread = async (input: { title: string; clubId?: string; bookId?: string }): Promise<Thread> => {
  const { data } = await api.post<Thread>("/threads", input);
  return data;
};

export const fetchThreadById = async (threadId: string): Promise<{ thread: Thread; comments: Comment[] }> => {
  const { data } = await api.get<{ thread: Thread; comments: Comment[] }>(`/threads/${threadId}`);
  return data;
};

export const deleteThread = (threadId: string) => api.delete<null>(`/threads/${threadId}`);

export const addComment = async (threadId: string, content: string): Promise<Comment> => {
  const { data } = await api.post<Comment>(`/threads/${threadId}/comments`, { content });
  return data;
};

export const deleteComment = (commentId: string) => api.delete<null>(`/threads/comments/${commentId}`);
