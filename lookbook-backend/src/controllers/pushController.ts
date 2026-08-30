import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { PushSubscription } from "../models/PushSubscription";
import { isPushConfigured } from "../utils/webPush";
import { env } from "../config/env";

/** POST /notifications/subscribe — store a browser push subscription. */
export const saveSubscription = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { endpoint, keys, userAgent } = req.body as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
    userAgent?: string;
  };
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw ApiError.badRequest("A complete push subscription (endpoint + keys) is required.");
  }

  await PushSubscription.findOneAndUpdate(
    { user: req.user.id, endpoint },
    { user: req.user.id, endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, userAgent },
    { upsert: true, new: true }
  );

  return ApiResponse.ok(res, null, "Push subscription saved");
});

/** DELETE /notifications/subscribe — remove a subscription (user toggled off / unregistered). */
export const deleteSubscription = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { endpoint } = req.body as { endpoint?: string };
  const filter: Record<string, unknown> = { user: req.user.id };
  if (endpoint) filter.endpoint = endpoint;
  await PushSubscription.deleteMany(filter);

  return ApiResponse.ok(res, null, "Push subscription removed");
});

/** GET /notifications/push-config — exposes whether push is configured so the
 * UI can decide whether to even show the enable-push prompt. */
export const getPushConfig = asyncHandler(async (_req: Request, res: Response) => {
  return ApiResponse.ok(res, {
    configured: isPushConfigured(),
    // Public VAPID key, so the browser can create a push subscription scoped
    // to this server. Never expose the private key.
    publicKey: env.webPush.publicKey || "",
  });
});