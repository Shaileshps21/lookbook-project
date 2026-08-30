import { z } from "zod";

export const updatePreferencesSchema = z.object({
  genres: z.array(z.string().trim()).max(20).default([]),
  authors: z.array(z.string().trim()).max(20).default([]),
  readingGoal: z.number().int().min(1).max(365).optional(),
  language: z.string().trim().max(40).optional(),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;

export const updateMeSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80).optional(),
  avatar: z.string().trim().url("Avatar must be a valid URL").optional(),
});

export type UpdateMeInput = z.infer<typeof updateMeSchema>;

export const updateEmailPreferencesSchema = z
  .object({
    orderUpdates: z.boolean().optional(),
    rentalReminders: z.boolean().optional(),
    priceDropAlerts: z.boolean().optional(),
    sellerNotifications: z.boolean().optional(),
    marketing: z.boolean().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: "At least one preference is required" });

export type UpdateEmailPreferencesInput = z.infer<typeof updateEmailPreferencesSchema>;
