import { z } from "zod";

export const createListingSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  author: z.string().trim().min(1, "Author is required"),
  category: z.string().trim().min(1, "Category is required"),
  price: z.number().positive("Price must be greater than 0"),
  condition: z.enum(["New", "Like New", "Good", "Fair", "Worn"]).default("Good"),
  description: z.string().trim().max(1000).optional(),
  images: z.array(z.string().trim()).default([]),
});

export const updateListingStatusSchema = z.object({
  status: z.enum(["Pending", "Approved", "Rejected"]),
});
