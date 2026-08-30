import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { Book } from "../models/Book";
import { logActivity } from "../utils/logActivity";
import { getOrCreateDefaultShelf } from "../utils/shelves";

/**
 * The Wishlist is now just the user's default private Shelf (see
 * future.md §6.2) — these three endpoints keep their original contract
 * (accept/return a plain Book[]) so the existing frontend needs no changes.
 */

export const getWishlist = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const shelf = await getOrCreateDefaultShelf(req.user.id);
  await shelf.populate("books");
  return ApiResponse.ok(res, shelf.books);
});

export const toggleWishlist = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { bookId } = req.params;
  const book = await Book.findById(bookId);
  if (!book) throw ApiError.notFound("Book not found");

  const shelf = await getOrCreateDefaultShelf(req.user.id);
  const index = shelf.books.findIndex((id) => id.toString() === bookId);

  if (index >= 0) {
    shelf.books.splice(index, 1);
  } else {
    shelf.books.push(book._id as never);
    logActivity(req.user.id, book.id, "wishlist");
  }

  await shelf.save();
  await shelf.populate("books");

  return ApiResponse.ok(res, shelf.books, index >= 0 ? "Removed from wishlist" : "Added to wishlist");
});

export const removeFromWishlist = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { bookId } = req.params;
  const shelf = await getOrCreateDefaultShelf(req.user.id);
  shelf.books = shelf.books.filter((id) => id.toString() !== bookId) as typeof shelf.books;

  await shelf.save();
  await shelf.populate("books");

  return ApiResponse.ok(res, shelf.books, "Removed from wishlist");
});
