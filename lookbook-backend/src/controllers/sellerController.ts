import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { Book, type IBook } from "../models/Book";
import { Order } from "../models/Order";
import { Payout } from "../models/Payout";
import { UserActivity } from "../models/UserActivity";

// Illustrative — a real marketplace would make this configurable per
// category/seller tier; flat 10% keeps the math easy to follow for now.
const PLATFORM_COMMISSION_RATE = 0.1;

export const getInventory = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const books = await Book.find({ sellerId: req.user.id }).sort("-createdAt");
  return ApiResponse.ok(res, books);
});

export const updateInventoryItem = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const book = await Book.findOne({ _id: req.params.bookId, sellerId: req.user.id });
  if (!book) throw ApiError.notFound("Listing not found in your inventory.");

  const { rentPrice, buyPrice, stock } = req.body as { rentPrice?: number; buyPrice?: number; stock?: number };
  if (rentPrice !== undefined) book.rentPrice = rentPrice;
  if (buyPrice !== undefined) book.buyPrice = buyPrice;
  if (stock !== undefined) book.stock = stock;
  await book.save();

  return ApiResponse.ok(res, book, "Inventory updated");
});

export const delistInventoryItem = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const book = await Book.findOneAndDelete({ _id: req.params.bookId, sellerId: req.user.id });
  if (!book) throw ApiError.notFound("Listing not found in your inventory.");

  return ApiResponse.ok(res, null, "Listing delisted");
});

const getSellerBookIds = async (sellerId: string): Promise<string[]> =>
  (await Book.find({ sellerId }).select("_id")).map((b) => b.id);

/** Shared by getSellerRevenue and requestPayout so the payout endpoint
 * re-derives the same numbers server-side rather than trusting a client
 * "here's my balance" claim. */
const computeSellerBalance = async (sellerId: string) => {
  const bookIds = await getSellerBookIds(sellerId);

  const orders = bookIds.length
    ? await Order.find({ paymentStatus: "paid", "items.book": { $in: bookIds } }).populate("items.book", "sellerId")
    : [];

  const grossRevenue = orders.reduce((sum, order) => {
    const sellerItemsTotal = order.items
      .filter((item) => (item.book as unknown as IBook)?.sellerId?.toString() === sellerId)
      .reduce((itemSum, item) => itemSum + item.price * item.quantity, 0);
    return sum + sellerItemsTotal;
  }, 0);

  const commission = Math.round(grossRevenue * PLATFORM_COMMISSION_RATE * 100) / 100;
  const netEarnings = grossRevenue - commission;

  const payouts = await Payout.find({ seller: sellerId }).sort("-createdAt");
  const paidOut = payouts.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);
  const pendingRequests = payouts.filter((p) => p.status === "requested").reduce((sum, p) => sum + p.amount, 0);
  const availableBalance = Math.max(netEarnings - paidOut - pendingRequests, 0);

  return { grossRevenue, commission, netEarnings, paidOut, pendingRequests, availableBalance, payouts };
};

export const getSellerOrders = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const bookIds = await getSellerBookIds(req.user.id);
  if (bookIds.length === 0) return ApiResponse.ok(res, []);

  const orders = await Order.find({ "items.book": { $in: bookIds } })
    .sort("-createdAt")
    .populate("items.book", "title image sellerId")
    .populate("user", "name email");

  // Only surface the line items that belong to this seller — an order can
  // mix books from multiple sellers (and the platform catalog).
  const result = orders
    .map((order) => ({
      id: order.id,
      createdAt: order.createdAt,
      status: order.status,
      paymentStatus: order.paymentStatus,
      buyer: order.user,
      items: order.items.filter((item) => {
        const book = item.book as unknown as IBook;
        return book?.sellerId?.toString() === req.user!.id;
      }),
    }))
    .filter((o) => o.items.length > 0);

  return ApiResponse.ok(res, result);
});

export const getSellerRevenue = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const balance = await computeSellerBalance(req.user.id);
  return ApiResponse.ok(res, { ...balance, commissionRate: PLATFORM_COMMISSION_RATE });
});

export const requestPayout = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { amount } = req.body as { amount: number };
  if (!amount || amount <= 0) throw ApiError.badRequest("Enter a valid payout amount.");

  // Re-derive the available balance server-side rather than trusting the
  // client's number, same principle as payment verification.
  const { availableBalance } = await computeSellerBalance(req.user.id);

  if (amount > availableBalance) {
    throw ApiError.badRequest(`Requested amount exceeds your available balance of ₹${Math.floor(availableBalance)}.`);
  }

  const payout = await Payout.create({ seller: req.user.id, amount, status: "requested" });
  return ApiResponse.created(res, payout, "Payout requested");
});

export const getSellerPerformance = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const books = await Book.find({ sellerId: req.user.id });

  const [views, wishlists, purchases] = await Promise.all([
    UserActivity.aggregate([
      { $match: { book: { $in: books.map((b) => b._id) }, action: "view" } },
      { $group: { _id: "$book", count: { $sum: 1 } } },
    ]),
    UserActivity.aggregate([
      { $match: { book: { $in: books.map((b) => b._id) }, action: "wishlist" } },
      { $group: { _id: "$book", count: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { paymentStatus: "paid" } },
      { $unwind: "$items" },
      { $match: { "items.book": { $in: books.map((b) => b._id) } } },
      { $group: { _id: "$items.book", count: { $sum: "$items.quantity" } } },
    ]),
  ]);

  const toMap = (rows: { _id: unknown; count: number }[]) => new Map(rows.map((r) => [String(r._id), r.count]));
  const viewsMap = toMap(views);
  const wishlistsMap = toMap(wishlists);
  const purchasesMap = toMap(purchases);

  const performance = books.map((book) => ({
    bookId: book.id,
    title: book.title,
    views: viewsMap.get(book.id) ?? 0,
    wishlists: wishlistsMap.get(book.id) ?? 0,
    purchases: purchasesMap.get(book.id) ?? 0,
  }));

  return ApiResponse.ok(res, performance);
});
