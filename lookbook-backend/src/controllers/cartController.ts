import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { Book } from "../models/Book";
import type { CartMode } from "../models/User";

export const getCart = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const user = await req.user.populate("cart.book");

  // A book can be removed from the catalog after it was added to a cart, which
  // populates item.book to null — drop those stale entries rather than crash
  // reading rentPrice/buyPrice off a null reference.
  const items = user.cart.filter((item) => (item.book as unknown) != null);

  const subtotal = items.reduce((sum, item) => {
    const book = item.book as unknown as { rentPrice: number; buyPrice: number };
    const price = item.mode === "rent" ? book.rentPrice : book.buyPrice;
    return sum + price * item.quantity;
  }, 0);

  return ApiResponse.ok(res, { items, subtotal, itemCount: items.reduce((s, i) => s + i.quantity, 0) });
});

export const addToCart = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { bookId, mode } = req.body as { bookId: string; mode: CartMode };

  const book = await Book.findById(bookId);
  if (!book) throw ApiError.notFound("Book not found");

  const existing = req.user.cart.find(
    (item) => item.book.toString() === bookId && item.mode === mode
  );

  if (existing) {
    existing.quantity += 1;
  } else {
    req.user.cart.push({ book: book._id, mode, quantity: 1 } as never);
  }

  await req.user.save();
  const populated = await req.user.populate("cart.book");

  return ApiResponse.created(res, populated.cart, "Added to cart");
});

export const updateCartItem = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { bookId, mode } = req.params as { bookId: string; mode: CartMode };
  const { quantity } = req.body as { quantity: number };

  if (quantity <= 0) {
    req.user.cart = req.user.cart.filter(
      (item) => !(item.book.toString() === bookId && item.mode === mode)
    ) as typeof req.user.cart;
  } else {
    const item = req.user.cart.find(
      (i) => (i.book as unknown) != null && i.book.toString() === bookId && i.mode === mode
    );
    if (!item) throw ApiError.notFound("Cart item not found");
    item.quantity = quantity;
  }

  await req.user.save();
  const populated = await req.user.populate("cart.book");

  return ApiResponse.ok(res, populated.cart, "Cart updated");
});

export const removeFromCart = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { bookId, mode } = req.params as { bookId: string; mode: CartMode };

  req.user.cart = req.user.cart.filter(
    (item) => (item.book as unknown) == null || !(item.book.toString() === bookId && item.mode === mode)
  ) as typeof req.user.cart;

  await req.user.save();
  return ApiResponse.ok(res, req.user.cart, "Item removed from cart");
});

export const clearCart = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  req.user.cart = [] as typeof req.user.cart;
  await req.user.save();

  return ApiResponse.ok(res, [], "Cart cleared");
});
