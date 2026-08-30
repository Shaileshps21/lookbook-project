import { z } from "zod";

export const upsertAddressSchema = z.object({
  label: z.string().trim().min(1).max(40),
  line1: z.string().trim().min(1),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(1),
  state: z.string().trim().min(1),
  pincode: z.string().trim().min(4).max(10),
  isDefault: z.boolean().optional(),
});

export type UpsertAddressInput = z.infer<typeof upsertAddressSchema>;
