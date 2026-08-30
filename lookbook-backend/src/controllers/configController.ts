import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { env } from "../config/env";
import { stripeConfigured, stripePublishableConfigured } from "../utils/stripe";
import { isPushConfigured } from "../utils/webPush";

/**
 * Public capability flags so the frontend only surfaces what this server can
 * actually do (payment providers, push, AI). No secrets are ever exposed.
 */
export const getClientConfig = asyncHandler(async (_req: Request, res: Response) => {
  return ApiResponse.ok(res, {
    razorpay: { available: Boolean(env.razorpay.keyId && env.razorpay.keySecret), keyId: env.razorpay.keyId },
    stripe: { available: stripeConfigured, publishableKey: stripeConfigured ? stripePublishableConfigured : "" },
    push: { configured: isPushConfigured() },
    ai: { configured: Boolean(env.gemini.apiKey) },
  });
});