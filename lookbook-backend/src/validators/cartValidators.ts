import { z } from "zod";

export const addToCartSchema = z.object({
  bookId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid bookId"),
  mode: z.enum(["rent", "buy"]),
});

export const updateCartSchema = z.object({
  quantity: z.number().int().min(0),
});
