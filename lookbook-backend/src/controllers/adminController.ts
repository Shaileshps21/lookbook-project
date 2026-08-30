import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { User } from "../models/User";
import { Order, type OrderStatus } from "../models/Order";
import { Book } from "../models/Book";
import { Listing } from "../models/Listing";
import { UserActivity } from "../models/UserActivity";
import { Payout } from "../models/Payout";
import { sendMail, shouldSendEmail } from "../utils/mailer";
import { createRefund } from "../utils/razorpay";
import { recordAuditLog } from "../utils/auditLog";
import { AuditLog } from "../models/AuditLog";
import { notify } from "../utils/notify";
import { buildRefundHtml } from "../utils/mailer";
import { AnalyticsSnapshot } from "../models/AnalyticsSnapshot";

export const getPendingSellerApplications = asyncHandler(async (_req: Request, res: Response) => {
  const users = await User.find({ "sellerApplication.status": "pending" }).select(
    "name email sellerApplication createdAt"
  );
  return ApiResponse.ok(res, users);
});

export const approveSeller = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.userId);
  if (!user) throw ApiError.notFound("User not found");

  user.isSeller = true;
  user.sellerApplication = { status: "approved", reviewedAt: new Date() };
  await user.save();
  recordAuditLog(req.user!.id, "seller.approve", "User", user.id);
  notify(user.id, "seller.approved", "Seller application approved", "You can now manage listings from your Seller Dashboard.", "/seller");

  shouldSendEmail(user.id, "sellerNotifications").then((allowed) => {
    if (!allowed) return;
    sendMail({
      to: user.email,
      subject: "Your LookBook seller application was approved",
      html: `<p>Hi ${user.name},</p><p>Your seller application has been approved — you can now manage listings from your Seller Dashboard.</p>`,
    }).catch(() => {
      // eslint-disable-next-line no-console
      console.warn(`[mail] Failed to send seller-approval email to ${user.email}`);
    });
  });

  return ApiResponse.ok(res, { isSeller: user.isSeller, sellerApplication: user.sellerApplication }, "Seller approved");
});

export const rejectSeller = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.userId);
  if (!user) throw ApiError.notFound("User not found");

  const { reason } = req.body as { reason?: string };
  user.sellerApplication = { status: "rejected", reviewedAt: new Date(), rejectionReason: reason };
  await user.save();
  recordAuditLog(req.user!.id, "seller.reject", "User", user.id, { reason });
  notify(user.id, "seller.rejected", "Seller application update", reason || "Your seller application wasn't approved this time.");

  shouldSendEmail(user.id, "sellerNotifications").then((allowed) => {
    if (!allowed) return;
    sendMail({
      to: user.email,
      subject: "Your LookBook seller application was not approved",
      html: `<p>Hi ${user.name},</p><p>Your seller application wasn't approved this time.${reason ? ` Reason: ${reason}` : ""}</p>`,
    }).catch(() => {
      // eslint-disable-next-line no-console
      console.warn(`[mail] Failed to send seller-rejection email to ${user.email}`);
    });
  });

  return ApiResponse.ok(res, { sellerApplication: user.sellerApplication }, "Seller application rejected");
});

export const getPendingDamageReports = asyncHandler(async (_req: Request, res: Response) => {
  const orders = await Order.find({ "items.damageReport.status": "pending" })
    .populate("items.book", "title author")
    .populate("user", "name email");
  return ApiResponse.ok(res, orders);
});

export const resolveDamageReport = asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) throw ApiError.notFound("Order not found");

  const item = order.items[Number(req.params.itemIndex)];
  if (!item?.damageReport) throw ApiError.notFound("Damage report not found");

  const { feeCharged } = req.body as { feeCharged?: number };
  item.damageReport.status = "resolved";
  item.damageReport.feeCharged = feeCharged;
  await order.save();
  recordAuditLog(req.user!.id, "damage.resolve", "Order", order.id, { itemIndex: req.params.itemIndex, feeCharged });

  return ApiResponse.ok(res, order, "Damage report resolved");
});

/** Headline metrics for the admin dashboard home. Computed live — there's no
 * scheduled analytics/aggregation layer yet (see future.md Phase 11). */
export const getDashboardMetrics = asyncHandler(async (_req: Request, res: Response) => {
  const [revenueAgg, totalUsers, totalBooks, pendingSellers, pendingListings, pendingDamage, totalOrders] =
    await Promise.all([
      Order.aggregate([{ $match: { paymentStatus: "paid" } }, { $group: { _id: null, total: { $sum: "$total" } } }]),
      User.countDocuments(),
      Book.countDocuments(),
      User.countDocuments({ "sellerApplication.status": "pending" }),
      Listing.countDocuments({ status: "Pending" }),
      Order.countDocuments({ "items.damageReport.status": "pending" }),
      Order.countDocuments(),
    ]);

  return ApiResponse.ok(res, {
    revenue: revenueAgg[0]?.total ?? 0,
    totalUsers,
    totalBooks,
    totalOrders,
    pendingSellerApplications: pendingSellers,
    pendingListings,
    pendingDamageReports: pendingDamage,
  });
});

export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const search = (req.query.search as string | undefined)?.trim();
  const filter = search
    ? { $or: [{ name: new RegExp(search, "i") }, { email: new RegExp(search, "i") }] }
    : {};

  const users = await User.find(filter).sort("-createdAt").limit(100).select("-password");
  return ApiResponse.ok(res, users);
});

export const getUserActivity = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.userId).select("-password");
  if (!user) throw ApiError.notFound("User not found");

  const [activity, orders] = await Promise.all([
    UserActivity.find({ user: user.id }).sort("-createdAt").limit(30).populate("book", "title"),
    Order.find({ user: user.id }).sort("-createdAt").limit(20),
  ]);

  return ApiResponse.ok(res, { user, recentActivity: activity, recentOrders: orders });
});

export const suspendUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.userId);
  if (!user) throw ApiError.notFound("User not found");
  if (user.role === "admin") throw ApiError.badRequest("Cannot suspend an admin account.");

  const { reason } = req.body as { reason?: string };
  user.suspended = true;
  user.suspendedReason = reason;
  await user.save();
  recordAuditLog(req.user!.id, "user.suspend", "User", user.id, { reason });

  return ApiResponse.ok(res, { suspended: user.suspended }, "User suspended");
});

export const reinstateUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.userId);
  if (!user) throw ApiError.notFound("User not found");

  user.suspended = false;
  user.suspendedReason = undefined;
  await user.save();
  recordAuditLog(req.user!.id, "user.reinstate", "User", user.id);

  return ApiResponse.ok(res, { suspended: user.suspended }, "User reinstated");
});

export const getAdminOrders = asyncHandler(async (req: Request, res: Response) => {
  const { status, paymentStatus, search } = req.query as Record<string, string | undefined>;
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (paymentStatus) filter.paymentStatus = paymentStatus;

  let userIds: string[] | undefined;
  if (search) {
    const matchingUsers = await User.find({
      $or: [{ name: new RegExp(search, "i") }, { email: new RegExp(search, "i") }],
    }).select("_id");
    userIds = matchingUsers.map((u) => u.id);
    filter.user = { $in: userIds };
  }

  const orders = await Order.find(filter)
    .sort("-createdAt")
    .limit(100)
    .populate("items.book", "title")
    .populate("user", "name email");

  return ApiResponse.ok(res, orders);
});

const VALID_STATUSES: OrderStatus[] = ["Placed", "Active", "Delivered", "Returned", "Cancelled"];

export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body as { status: OrderStatus };
  if (!VALID_STATUSES.includes(status)) throw ApiError.badRequest("Invalid status.");

  const order = await Order.findById(req.params.orderId);
  if (!order) throw ApiError.notFound("Order not found");

  order.status = status;
  await order.save();
  await order.populate([{ path: "items.book", select: "title" }, { path: "user", select: "name email" }]);
  recordAuditLog(req.user!.id, "order.updateStatus", "Order", order.id, { status });

  return ApiResponse.ok(res, order, "Order status updated");
});

/** Admin sets/updates delivery tracking on an order (future.md §2.3). */
export const updateOrderTracking = asyncHandler(async (req: Request, res: Response) => {
  const { trackingNumber, carrier, shipmentStatus, trackingUrl, pickupSlot } = req.body as {
    trackingNumber?: string;
    carrier?: string;
    shipmentStatus?: "pending" | "in_transit" | "delivered" | "failed";
    trackingUrl?: string;
    pickupSlot?: string;
  };

  const order = await Order.findById(req.params.orderId);
  if (!order) throw ApiError.notFound("Order not found");

  if (trackingNumber !== undefined) order.trackingNumber = trackingNumber;
  if (carrier !== undefined) order.carrier = carrier;
  if (shipmentStatus !== undefined) order.shipmentStatus = shipmentStatus;
  if (trackingUrl !== undefined) order.trackingUrl = trackingUrl;
  if (pickupSlot !== undefined) order.pickupSlot = pickupSlot;
  await order.save();
  await order.populate([{ path: "items.book", select: "title" }, { path: "user", select: "name email" }]);
  recordAuditLog(req.user!.id, "order.updateTracking", "Order", order.id, { trackingNumber, carrier, shipmentStatus });

  return ApiResponse.ok(res, order, "Tracking information saved");
});

export const refundOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findById(req.params.orderId).select("+razorpaySignature");
  if (!order) throw ApiError.notFound("Order not found");
  if (order.paymentStatus !== "paid" || !order.razorpayPaymentId) {
    throw ApiError.badRequest("Only paid orders can be refunded.");
  }

  await createRefund(order.razorpayPaymentId, order.total);
  order.paymentStatus = "refunded";
  await order.save();
  await order.populate([{ path: "items.book", select: "title" }, { path: "user", select: "name email" }]);
  recordAuditLog(req.user!.id, "order.refund", "Order", order.id, { amount: order.total });
  notify(order.user.toString(), "order.refunded", "Refund processed", `₹${order.total} has been refunded to you.`, "/profile");

  const refundUser = order.user as unknown as { id: string; email: string };
  if (refundUser?.email) {
    shouldSendEmail(refundUser.id, "orderUpdates").then((allowed) => {
      if (!allowed) return;
      sendMail({ to: refundUser.email, subject: "Your LookBook refund has been processed", html: buildRefundHtml(order.total) }).catch(() => {
        // eslint-disable-next-line no-console
        console.warn(`[mail] Failed to send refund email for order ${order.id}`);
      });
    });
  }

  return ApiResponse.ok(res, order, "Order refunded");
});

export const getPendingPayouts = asyncHandler(async (_req: Request, res: Response) => {
  const payouts = await Payout.find({ status: "requested" }).sort("-requestedAt").populate("seller", "name email");
  return ApiResponse.ok(res, payouts);
});

export const resolvePayout = asyncHandler(async (req: Request, res: Response) => {
  const { status, note } = req.body as { status: "paid" | "rejected"; note?: string };
  if (!["paid", "rejected"].includes(status)) throw ApiError.badRequest("Invalid status.");

  const payout = await Payout.findById(req.params.payoutId);
  if (!payout) throw ApiError.notFound("Payout not found");

  payout.status = status;
  payout.resolvedAt = new Date();
  payout.note = note;
  await payout.save();
  recordAuditLog(req.user!.id, "payout.resolve", "Payout", payout.id, { status, note });
  notify(
    payout.seller.toString(),
    "payout.resolved",
    `Payout ${status}`,
    status === "paid" ? `Your payout of ₹${payout.amount} has been paid.` : `Your payout request was rejected.${note ? ` ${note}` : ""}`,
    "/seller"
  );

  return ApiResponse.ok(res, payout, "Payout updated");
});

export const getAuditLogs = asyncHandler(async (_req: Request, res: Response) => {
  const logs = await AuditLog.find().sort("-createdAt").limit(200).populate("admin", "name email");
  return ApiResponse.ok(res, logs);
});

/** Backed by a daily BullMQ rollup (queues/analyticsQueue.ts) — see
 * future.md §11.2. Returns the last N daily snapshots, oldest first, so the
 * frontend can plot them directly as a time series. */
export const getAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const days = Math.min(Math.max(Number(req.query.days ?? 30), 1), 365);
  const snapshots = await AnalyticsSnapshot.find().sort("-date").limit(days);
  return ApiResponse.ok(res, snapshots.reverse());
});

/**
 * Smart pricing config (future.md Stretch 2) — admin opts a book into the
 * daily rule-based price-adjustment job and sets the rent-price bounds.
 */
export const configureBookPricing = asyncHandler(async (req: Request, res: Response) => {
  const { enabled, minRentPrice, maxRentPrice } = req.body as {
    enabled?: boolean;
    minRentPrice?: number;
    maxRentPrice?: number;
  };

  const book = await Book.findById(req.params.bookId);
  if (!book) throw ApiError.notFound("Book not found");

  const current = book.pricing ?? { enabled: false, minRentPrice: 0, maxRentPrice: 0 };
  const next: { enabled: boolean; minRentPrice: number; maxRentPrice: number } = {
    enabled: Boolean(enabled ?? current.enabled),
    minRentPrice: minRentPrice ?? current.minRentPrice ?? 0,
    maxRentPrice: maxRentPrice ?? current.maxRentPrice ?? 0,
  };
  if (next.maxRentPrice > 0 && next.minRentPrice >= next.maxRentPrice) {
    throw ApiError.badRequest("minRentPrice must be less than maxRentPrice.");
  }

  book.pricing = next;
  await book.save();
  recordAuditLog(req.user!.id, "book.configurePricing", "Book", book.id, next);
  return ApiResponse.ok(res, book.pricing, "Pricing configuration saved");
});

/** Manually trigger one smart-pricing sweep (enqueue) for testing. */
export const runPricingNow = asyncHandler(async (_req: Request, res: Response) => {
  const { pricingQueue } = await import("../queues/pricingQueue");
  if (!pricingQueue) {
    throw ApiError.badRequest("Redis isn't configured — the smart-pricing job is disabled.");
  }
  await pricingQueue.add("sweep-now", {});
  return ApiResponse.ok(res, null, "Smart-pricing sweep queued");
});
