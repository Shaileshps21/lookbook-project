import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { Plan } from "../models/Plan";
import { getCache, setCache } from "../config/redis";

const CACHE_KEY = "plans:all";
const CACHE_TTL_SECONDS = 600;

export const getPlans = asyncHandler(async (_req: Request, res: Response) => {
  const cached = await getCache<unknown>(CACHE_KEY);
  if (cached) return ApiResponse.ok(res, cached);

  const plans = await Plan.find().sort("price");
  await setCache(CACHE_KEY, plans, CACHE_TTL_SECONDS);

  return ApiResponse.ok(res, plans);
});
