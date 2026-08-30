import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { Category } from "../models/Category";
import { getCache, setCache } from "../config/redis";

export const CATEGORIES_CACHE_KEY = "categories:all";
const CACHE_TTL_SECONDS = 300;

export const getCategories = asyncHandler(async (_req: Request, res: Response) => {
  const cached = await getCache<unknown>(CATEGORIES_CACHE_KEY);
  if (cached) return ApiResponse.ok(res, cached);

  const categories = await Category.find().sort("name");
  await setCache(CATEGORIES_CACHE_KEY, categories, CACHE_TTL_SECONDS);

  return ApiResponse.ok(res, categories);
});
