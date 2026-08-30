import { api, setAccessToken, refreshAccessToken } from "./apiClient";
import type { Session, User } from "../types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const oauthUrls = {
  google: `${API_URL}/auth/google`,
  github: `${API_URL}/auth/github`,
};

interface AuthResponse {
  user: User;
  accessToken: string;
}

interface TwoFactorChallengeResponse {
  requiresTwoFactor: true;
  challengeToken: string;
}

/** Thrown by loginRequest when the account has 2FA enabled — password was
 * correct, but a second step (verifyTwoFactorLoginRequest) is still needed
 * before a real session is issued. */
export class TwoFactorRequiredError extends Error {
  challengeToken: string;
  constructor(challengeToken: string) {
    super("Two-factor authentication code required");
    this.challengeToken = challengeToken;
  }
}

export const loginRequest = async (
  email: string,
  password: string,
  rememberMe: boolean
): Promise<User> => {
  const { data } = await api.post<AuthResponse | TwoFactorChallengeResponse>("/auth/login", {
    email,
    password,
    rememberMe,
  });
  if ("requiresTwoFactor" in data) {
    throw new TwoFactorRequiredError(data.challengeToken);
  }
  setAccessToken(data.accessToken);
  return data.user;
};

export const verifyTwoFactorLoginRequest = async (challengeToken: string, token: string): Promise<User> => {
  const { data } = await api.post<AuthResponse>("/auth/2fa/login", { challengeToken, token });
  setAccessToken(data.accessToken);
  return data.user;
};

export const registerRequest = async (
  name: string,
  email: string,
  password: string
): Promise<User> => {
  const { data } = await api.post<AuthResponse>("/auth/register", { name, email, password });
  setAccessToken(data.accessToken);
  return data.user;
};

// Restores a session on app load using the httpOnly refresh cookie — there is
// no client-stored token to check first, this call is the source of truth.
// Goes through the shared single-flight refreshAccessToken() so that a
// duplicate call (e.g. React StrictMode's double-invoked mount effect) never
// races a second request against the same rotating cookie.
export const refreshSession = async (): Promise<User | null> => {
  const result = await refreshAccessToken<User>();
  return result?.user ?? null;
};

export const fetchCurrentUser = async (): Promise<User> => {
  const { data } = await api.get<{ user: User }>("/auth/me");
  return data.user;
};

export const logoutRequest = async (): Promise<void> => {
  try {
    await api.post("/auth/logout");
  } finally {
    setAccessToken(null);
  }
};

export const forgotPasswordRequest = (email: string) =>
  api.post<null>("/auth/forgot-password", { email });

export const resetPasswordRequest = (token: string, password: string) =>
  api.post<null>("/auth/reset-password", { token, password });

export const verifyEmailRequest = (token: string) =>
  api.post<null>("/auth/verify-email", { token });

export const resendVerificationRequest = () => api.post<null>("/auth/resend-verification");

export const fetchSessions = async (): Promise<Session[]> => {
  const { data } = await api.get<Session[]>("/auth/sessions");
  return data;
};

export const revokeSessionRequest = (id: string) => api.delete<null>(`/auth/sessions/${id}`);

export const setupTwoFactorRequest = async (): Promise<{ secret: string; otpauthUrl: string }> => {
  const { data } = await api.post<{ secret: string; otpauthUrl: string }>("/auth/2fa/setup");
  return data;
};

export const confirmTwoFactorRequest = (token: string) => api.post<{ twoFactorEnabled: boolean }>("/auth/2fa/confirm", { token });

export const disableTwoFactorRequest = (token: string) => api.post<{ twoFactorEnabled: boolean }>("/auth/2fa/disable", { token });

export const changePasswordRequest = (currentPassword: string, newPassword: string) =>
  api.patch<null>("/auth/change-password", { currentPassword, newPassword });
