import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { Notification } from "../models/Notification";

export const getMyNotifications = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const notifications = await Notification.find({ user: req.user.id }).sort("-createdAt").limit(50);
  return ApiResponse.ok(res, notifications);
});

export const getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const count = await Notification.countDocuments({ user: req.user.id, read: false });
  return ApiResponse.ok(res, { count });
});

export const markNotificationRead = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const notification = await Notification.findOne({ _id: req.params.id, user: req.user.id });
  if (!notification) throw ApiError.notFound("Notification not found");

  notification.read = true;
  await notification.save();
  return ApiResponse.ok(res, notification, "Marked as read");
});

export const markAllNotificationsRead = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await Notification.updateMany({ user: req.user.id, read: false }, { read: true });
  return ApiResponse.ok(res, null, "All notifications marked as read");
});
