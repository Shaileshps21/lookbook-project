import { z } from "zod";

export const createReviewSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().trim().min(3, "Review must be at least 3 characters").max(1000),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
