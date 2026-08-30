import { z } from "zod";

export const bookQuerySchema = z.object({
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
  sort: z.enum(["popular", "price-asc", "price-desc", "rating", "newest"]).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

export const createBookSchema = z.object({
  title: z.string().trim().min(1),
  author: z.string().trim().min(1),
  image: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1),
  rentPrice: z.number().min(0),
  buyPrice: z.number().min(0),
  description: z.string().trim().min(1),
  publisher: z.string().trim().min(1),
  published: z.string().trim().min(1),
  pages: z.number().int().positive(),
  language: z.string().trim().min(1).default("English"),
  isbn: z.string().trim().min(1),
  stock: z.number().int().min(0).default(0),
  badge: z.string().trim().optional(),
  tags: z.array(z.string().trim()).default([]),
});

export const updateBookSchema = createBookSchema.partial();

export const idParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid id"),
});
