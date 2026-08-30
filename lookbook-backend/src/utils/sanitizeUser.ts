import type { ISellerApplication, IUserPreferences, IEmailPreferences } from "../models/User";

export const sanitizeUser = (user: {
  id?: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  isSeller: boolean;
  sellerApplication: ISellerApplication;
  emailVerified: boolean;
  preferences: IUserPreferences;
  emailPreferences: IEmailPreferences;
  publicProfile?: boolean;
  twoFactorEnabled?: boolean;
  createdAt: Date;
}) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  role: user.role,
  isSeller: user.isSeller,
  sellerApplication: user.sellerApplication,
  emailVerified: user.emailVerified,
  preferences: user.preferences,
  emailPreferences: user.emailPreferences,
  publicProfile: user.publicProfile,
  twoFactorEnabled: user.twoFactorEnabled,
  joined: user.createdAt,
});
