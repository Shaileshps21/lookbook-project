import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { Order } from "../models/Order";
import { Book } from "../models/Book";
import { User } from "../models/User";
import { logActivity } from "../utils/logActivity";
import { createRazorpayOrder, verifyPaymentSignature, verifyWebhookSignature, createRefund } from "../utils/razorpay";
import { createStripeCheckoutSession, stripeConfigured, verifyStripeWebhookSignature, retrieveStripeSession } from "../utils/stripe";
import { env } from "../config/env";
import { notify } from "../utils/notify";
import { sendMail, buildOrderConfirmationHtml } from "../utils/mailer";
import { calculateLateFee } from "../utils/lateFee";
import { validateCouponForCart } from "../utils/coupon";
import { Coupon } from "../models/Coupon";

const DELIVERY_FEE = 40;
const DAY_MS = 24 * 60 * 60 * 1000;

export const checkout = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { address, provider, couponCode } = req.body as {
    address?: string;
    provider?: "razorpay" | "stripe";
    couponCode?: string;
  };
  const payProvider = provider === "stripe" ? "stripe" : "razorpay";
  if (payProvider === "stripe" && !stripeConfigured) {
    throw ApiError.badRequest("Card payments aren't configured on this server yet.");
  }

  const user = await req.user.populate("cart.book");
  if (user.cart.length === 0) {
    throw ApiError.badRequest("Your cart is empty.");
  }

  const hasOverdueUnpaidRental = await Order.exists({
    user: req.user.id,
    items: { $elemMatch: { mode: "rent", dueDate: { $lt: new Date() }, returnedAt: null } },
  });
  if (hasOverdueUnpaidRental) {
    throw ApiError.badRequest("You have an overdue rental. Please return or settle it before renting again.");
  }

  // Books removed from the catalog after being added to a cart populate to
  // null — ignore those stale entries rather than read prices off null.
  const cartItems = user.cart.filter((item) => (item.book as unknown) != null);
  if (cartItems.length === 0) {
    throw ApiError.badRequest("Your cart is empty.");
  }

  const items = cartItems.map((item) => {
    const book = item.book as unknown as { _id: string; rentPrice: number; buyPrice: number; stock: number };
    const price = item.mode === "rent" ? book.rentPrice : book.buyPrice;
    return { book: book._id, mode: item.mode, quantity: item.quantity, price };
  });

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const delivery = DELIVERY_FEE;
  const preDiscountTotal = subtotal + delivery;

  // Coupon discount is always recomputed server-side off the real cart
  // total — never trusted from the client, and validated with the exact
  // same logic /coupons/validate uses so the two can never disagree.
  let discountAmount = 0;
  let appliedCouponCode: string | undefined;
  if (couponCode) {
    const result = await validateCouponForCart(couponCode, preDiscountTotal);
    if (!result.valid) throw ApiError.badRequest(result.message);
    discountAmount = result.discountAmount;
    appliedCouponCode = result.coupon?.code;
  }
  const total = preDiscountTotal - discountAmount;

  // The Order is the source of truth for what was ordered, created before
  // payment is confirmed. Stock/cart/activity only change once verifyPayment
  // confirms money actually moved — never trust a client "it succeeded" claim.
  const order = await Order.create({
    user: req.user.id,
    items,
    subtotal,
    delivery,
    total,
    couponCode: appliedCouponCode,
    discountAmount,
    status: "Placed",
    paymentStatus: "pending",
    address,
  });

  if (payProvider === "stripe") {
    const clientUrl = req.headers.origin ?? env.clientUrl;
    const session = await createStripeCheckoutSession({
      orderId: order.id,
      amountPaise: Math.round(total * 100),
      items: items.map((i) => ({ title: "Book", mode: i.mode, quantity: i.quantity, price: i.price })),
      successUrl: `${clientUrl}/orders/${order.id}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${clientUrl}/cart?payment=cancelled`,
    });
    order.paymentProvider = "stripe";
    order.stripeSessionId = session.sessionId;
    await order.save();
    return ApiResponse.created(res, { order, provider: "stripe", stripe: session }, "Order created — complete payment on Stripe");
  }

  const razorpayOrder = await createRazorpayOrder(total, order.id);
  order.paymentProvider = "razorpay";
  order.razorpayOrderId = razorpayOrder.id;
  await order.save();

  return ApiResponse.created(
    res,
    {
      order,
      provider: "razorpay",
      razorpay: { orderId: razorpayOrder.id, amount: razorpayOrder.amount, currency: razorpayOrder.currency, keyId: env.razorpay.keyId },
    },
    "Order created — complete payment to confirm"
  );
});

/** Shared by the client-side verify call and (when a public URL exists) the webhook. */
const finalizePaidOrder = async (order: InstanceType<typeof Order>) => {
  if (order.paymentStatus === "paid") return; // idempotent — webhook + client verify may both fire

  order.paymentStatus = "paid";
  await order.save();

  // Increment usage only here, inside the idempotency gate above — both the
  // client verify-payment call and the webhook converge on this function,
  // and only the first to arrive can ever pass the "already paid" check, so
  // a coupon can never be double-counted no matter which path (or both)
  // actually fires.
  if (order.couponCode) {
    await Coupon.updateOne({ code: order.couponCode }, { $inc: { usedCount: 1 } });
  }

  await Promise.all(
    order.items.map((item) =>
      Book.findByIdAndUpdate(item.book, { $inc: { stock: -item.quantity } })
    )
  );

  const rentDueDate = new Date(Date.now() + env.rental.defaultDurationDays * DAY_MS);
  order.items.forEach((item) => {
    if (item.mode === "rent") item.dueDate = rentDueDate;
  });
  await order.save();

  const user = await User.findById(order.user);
  if (user) {
    user.cart = user.cart.filter(
      (cartItem) => !order.items.some((oi) => oi.book.toString() === cartItem.book.toString())
    ) as typeof user.cart;
    await user.save();
  }

  order.items.forEach((item) => logActivity(order.user.toString(), item.book.toString(), item.mode));

  notify(
    order.user.toString(),
    "order.confirmed",
    "Order confirmed",
    `Your order of ${order.items.length} item${order.items.length === 1 ? "" : "s"} (₹${order.total}) is confirmed.`,
    "/profile"
  );

  if (user && user.emailPreferences?.orderUpdates !== false) {
    const populatedItems = await Book.find({ _id: { $in: order.items.map((i) => i.book) } }).select("title");
    const titleById = new Map(populatedItems.map((b) => [b.id, b.title]));
    sendMail({
      to: user.email,
      subject: "Your LookBook order is confirmed",
      html: buildOrderConfirmationHtml(
        order.items.map((i) => ({ title: titleById.get(i.book.toString()) ?? "Book", mode: i.mode, price: i.price })),
        order.total
      ),
    }).catch(() => {
      // eslint-disable-next-line no-console
      console.warn(`[mail] Failed to send order confirmation to ${user.email}`);
    });
  }
};

export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { provider, razorpay_order_id, razorpay_payment_id, razorpay_signature, stripe_session_id } = req.body as {
    provider?: "razorpay" | "stripe";
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    stripe_session_id?: string;
  };

  const order = await Order.findById(req.params.id);
  if (!order) throw ApiError.notFound("Order not found");
  if (order.user.toString() !== req.user.id) throw ApiError.forbidden();

  // Stripe path — hosted Checkout Session; the webhook is authoritative but
  // this gives the buyer instant confirmation without waiting for the ping.
  if (provider === "stripe" || order.paymentProvider === "stripe") {
    if (!order.stripeSessionId || order.stripeSessionId !== stripe_session_id) {
      throw ApiError.badRequest("Session mismatch.");
    }
    const session = await retrieveStripeSession(order.stripeSessionId);
    if (!session || session.status !== "complete" || session.paymentStatus !== "paid") {
      order.paymentStatus = "failed";
      await order.save();
      throw ApiError.badRequest("Payment not completed. Please try again.");
    }
    await finalizePaidOrder(order);
    await order.populate("items.book");
    return ApiResponse.ok(res, order, "Payment verified — order confirmed");
  }

  if (order.razorpayOrderId !== razorpay_order_id) throw ApiError.badRequest("Order mismatch.");

  const valid = verifyPaymentSignature({
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
  });

  if (!valid) {
    order.paymentStatus = "failed";
    await order.save();
    throw ApiError.badRequest("Payment verification failed.");
  }

  order.razorpayPaymentId = razorpay_payment_id;
  order.razorpaySignature = razorpay_signature;
  await finalizePaidOrder(order);
  await order.populate("items.book");

  return ApiResponse.ok(res, order, "Payment verified — order confirmed");
});

/** Defense-in-depth confirmation path. Requires a publicly reachable URL
 * (e.g. via a tunnel in local dev) — Razorpay can't call back to localhost,
 * so this is unexercised until the app is deployed somewhere reachable. */
export const handleRazorpayWebhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers["x-razorpay-signature"] as string | undefined;
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody?.toString() ?? "";

  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    throw ApiError.unauthorized("Invalid webhook signature.");
  }

  const event = req.body as { event: string; payload: { payment: { entity: { order_id: string } } } };
  if (event.event === "payment.captured") {
    const order = await Order.findOne({ razorpayOrderId: event.payload.payment.entity.order_id });
    if (order) await finalizePaidOrder(order);
  }

  return ApiResponse.ok(res, null, "Webhook processed");
});

/** Stripe webhook (future.md §2.1) — the authoritative payment confirmation.
 * Stripe signs with an HMAC over the exact raw body, which express.json()
 * exposes via the verify hook in app.ts. */
export const handleStripeWebhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"] as string | undefined;
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody?.toString() ?? "";

  if (!signature || !verifyStripeWebhookSignature(rawBody, signature)) {
    throw ApiError.unauthorized("Invalid Stripe webhook signature.");
  }

  const event = req.body as {
    type: string;
    data: { object: { id?: string; metadata?: { orderId?: string } } };
  };
  if (event.type === "checkout.session.completed") {
    const sessionId = event.data.object.id;
    const order = await Order.findOne({ stripeSessionId: sessionId });
    if (order) {
      order.stripePaymentIntentId = "session_completed";
      await finalizePaidOrder(order);
    }
  }

  return ApiResponse.ok(res, null, "Webhook processed");
});

export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const order = await Order.findById(req.params.id).select("+razorpaySignature");
  if (!order) throw ApiError.notFound("Order not found");
  if (order.user.toString() !== req.user.id && req.user.role !== "admin") throw ApiError.forbidden();

  if (order.status !== "Placed") {
    throw ApiError.badRequest("Only orders that haven't shipped yet can be cancelled.");
  }

  if (order.paymentStatus === "paid" && order.razorpayPaymentId) {
    await createRefund(order.razorpayPaymentId, order.total);
    order.paymentStatus = "refunded";
    await Promise.all(order.items.map((item) => Book.findByIdAndUpdate(item.book, { $inc: { stock: item.quantity } })));
  }

  order.status = "Cancelled";
  await order.save();
  await order.populate("items.book");

  return ApiResponse.ok(res, order, "Order cancelled");
});

export const getMyOrders = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const orders = await Order.find({ user: req.user.id })
    .sort("-createdAt")
    .populate("items.book");

  return ApiResponse.ok(res, orders);
});

export const getOrderById = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const order = await Order.findById(req.params.id).populate("items.book");
  if (!order) throw ApiError.notFound("Order not found");

  if (order.user.toString() !== req.user.id && req.user.role !== "admin") {
    throw ApiError.forbidden("You don't have access to this order.");
  }

  return ApiResponse.ok(res, order);
});

export const returnItem = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const order = await Order.findById(req.params.id);
  if (!order) throw ApiError.notFound("Order not found");
  if (order.user.toString() !== req.user.id) throw ApiError.forbidden();

  const item = order.items[Number(req.params.itemIndex)];
  if (!item) throw ApiError.notFound("Order item not found");
  if (item.mode !== "rent") throw ApiError.badRequest("Only rented items can be returned.");
  if (item.returnedAt) throw ApiError.conflict("This item has already been returned.");

  item.returnedAt = new Date();
  item.lateFee = calculateLateFee(item);
  await order.save();
  await Book.findByIdAndUpdate(item.book, { $inc: { stock: item.quantity } });
  await order.populate("items.book");

  const message = item.lateFee
    ? `Item marked as returned — a late fee of ₹${item.lateFee} applies.`
    : "Item marked as returned";
  return ApiResponse.ok(res, order, message);
});

export const extendRental = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const order = await Order.findById(req.params.id);
  if (!order) throw ApiError.notFound("Order not found");
  if (order.user.toString() !== req.user.id) throw ApiError.forbidden();

  const item = order.items[Number(req.params.itemIndex)];
  if (!item || item.mode !== "rent") throw ApiError.badRequest("Only rented items can be extended.");
  if (item.returnedAt) throw ApiError.conflict("This item has already been returned.");

  const book = await Book.findById(item.book);
  if (!book) throw ApiError.notFound("Book not found");

  const extensionFee = Math.round(book.rentPrice * 0.5);
  const razorpayOrder = await createRazorpayOrder(extensionFee, `${order.id}-ext-${req.params.itemIndex}`);

  return ApiResponse.ok(res, {
    razorpay: { orderId: razorpayOrder.id, amount: razorpayOrder.amount, currency: razorpayOrder.currency, keyId: env.razorpay.keyId },
    extensionFee,
    extensionDays: env.rental.extensionDays,
  });
});

export const verifyExtensionPayment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body as {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  };

  const valid = verifyPaymentSignature({
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
  });
  if (!valid) throw ApiError.badRequest("Payment verification failed.");

  const order = await Order.findById(req.params.id);
  if (!order) throw ApiError.notFound("Order not found");
  if (order.user.toString() !== req.user.id) throw ApiError.forbidden();

  const item = order.items[Number(req.params.itemIndex)];
  if (!item || item.mode !== "rent") throw ApiError.badRequest("Only rented items can be extended.");

  item.dueDate = new Date((item.dueDate?.getTime() ?? Date.now()) + env.rental.extensionDays * DAY_MS);
  await order.save();
  await order.populate("items.book");

  return ApiResponse.ok(res, order, "Rental extended");
});

export const reportDamage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const order = await Order.findById(req.params.id);
  if (!order) throw ApiError.notFound("Order not found");
  if (order.user.toString() !== req.user.id) throw ApiError.forbidden();

  const item = order.items[Number(req.params.itemIndex)];
  if (!item) throw ApiError.notFound("Order item not found");

  const { reason } = req.body as { reason: string };
  if (!reason?.trim()) throw ApiError.badRequest("Please describe the issue.");

  // Recorded for admin review — actually charging a replacement fee is a
  // manual admin action for now (see future.md 2.2 §6); no automated
  // admin-initiated charge flow exists yet.
  item.damageReport = { reason: reason.trim(), reportedAt: new Date(), status: "pending" };
  await order.save();
  await order.populate("items.book");

  return ApiResponse.ok(res, order, "Damage report submitted for review");
});

const PICKUP_TIME_SLOTS = ["morning", "afternoon", "evening"] as const;
const PICKUP_WINDOW_DAYS = 7;

/** Lets a buyer self-schedule a return pickup within the next 7 days (future.md
 * Feature 5). No real courier API is wired up yet — this stores the slot and
 * notifies the user in-app, same "record it, don't fake automation" pattern
 * as the admin's manual tracking editor. */
export const schedulePickup = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { pickupDate, pickupTimeSlot } = req.body as { pickupDate?: string; pickupTimeSlot?: string };
  if (!pickupDate || !PICKUP_TIME_SLOTS.includes(pickupTimeSlot as (typeof PICKUP_TIME_SLOTS)[number])) {
    throw ApiError.badRequest("A pickup date and a valid time slot (morning/afternoon/evening) are required.");
  }

  const parsedDate = new Date(pickupDate);
  if (Number.isNaN(parsedDate.getTime())) {
    throw ApiError.badRequest("Invalid pickup date.");
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const latestAllowed = new Date(startOfToday.getTime() + PICKUP_WINDOW_DAYS * DAY_MS);
  if (parsedDate < startOfToday || parsedDate > latestAllowed) {
    throw ApiError.badRequest(`Pickup date must be within the next ${PICKUP_WINDOW_DAYS} days.`);
  }

  const order = await Order.findById(req.params.id);
  if (!order) throw ApiError.notFound("Order not found");
  if (order.user.toString() !== req.user.id) throw ApiError.forbidden();

  const item = order.items[Number(req.params.itemIndex)];
  if (!item) throw ApiError.notFound("Order item not found");

  item.pickupDate = parsedDate;
  item.pickupTimeSlot = pickupTimeSlot as (typeof PICKUP_TIME_SLOTS)[number];
  item.pickupScheduledAt = new Date();
  await order.save();
  await order.populate("items.book");

  notify(
    req.user.id,
    "order.pickupScheduled",
    "Pickup scheduled",
    `Your book pickup is scheduled for ${parsedDate.toLocaleDateString("en-IN", { month: "long", day: "numeric" })} (${pickupTimeSlot}).`,
    "/profile"
  );

  return ApiResponse.ok(res, order, "Pickup scheduled");
});
