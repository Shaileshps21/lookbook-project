import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { Shelf } from "../models/Shelf";
import { Book } from "../models/Book";
import { getOrCreateDefaultShelf } from "../utils/shelves";

export const getMyShelves = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await getOrCreateDefaultShelf(req.user.id);
  const shelves = await Shelf.find({ user: req.user.id }).populate("books").sort({ isDefault: -1, createdAt: 1 });
  return ApiResponse.ok(res, shelves);
});

export const createShelf = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { name, visibility } = req.body as { name: string; visibility?: "private" | "public" };
  if (!name?.trim()) throw ApiError.badRequest("Shelf name is required.");

  const existing = await Shelf.findOne({ user: req.user.id, name: name.trim() });
  if (existing) throw ApiError.conflict("You already have a shelf with that name.");

  const shelf = await Shelf.create({
    user: req.user.id,
    name: name.trim(),
    visibility: visibility === "public" ? "public" : "private",
    books: [],
  });

  return ApiResponse.created(res, shelf, "Shelf created");
});

const findOwnedShelf = async (userId: string, shelfId: string) => {
  const shelf = await Shelf.findById(shelfId);
  if (!shelf) throw ApiError.notFound("Shelf not found");
  if (shelf.user.toString() !== userId) throw ApiError.forbidden();
  return shelf;
};

export const updateShelf = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const shelf = await findOwnedShelf(req.user.id, req.params.shelfId);

  const { name, visibility } = req.body as { name?: string; visibility?: "private" | "public" };
  if (name?.trim()) shelf.name = name.trim();
  if (visibility === "private" || visibility === "public") shelf.visibility = visibility;

  await shelf.save();
  return ApiResponse.ok(res, shelf, "Shelf updated");
});

export const deleteShelf = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const shelf = await findOwnedShelf(req.user.id, req.params.shelfId);

  if (shelf.isDefault) throw ApiError.badRequest("The default Wishlist shelf can't be deleted.");

  await shelf.deleteOne();
  return ApiResponse.ok(res, null, "Shelf deleted");
});

export const addBookToShelf = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const shelf = await findOwnedShelf(req.user.id, req.params.shelfId);

  const { bookId } = req.params;
  const book = await Book.findById(bookId);
  if (!book) throw ApiError.notFound("Book not found");

  if (!shelf.books.some((id) => id.toString() === bookId)) {
    shelf.books.push(book._id as never);
    await shelf.save();
  }

  await shelf.populate("books");
  return ApiResponse.ok(res, shelf, "Added to shelf");
});

export const removeBookFromShelf = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const shelf = await findOwnedShelf(req.user.id, req.params.shelfId);

  shelf.books = shelf.books.filter((id) => id.toString() !== req.params.bookId) as typeof shelf.books;
  await shelf.save();
  await shelf.populate("books");

  return ApiResponse.ok(res, shelf, "Removed from shelf");
});

/** Public read: only shelves marked visibility:"public" are visible to others. */
export const getPublicShelves = asyncHandler(async (req: Request, res: Response) => {
  const shelves = await Shelf.find({ user: req.params.userId, visibility: "public" })
    .populate("books")
    .sort({ createdAt: 1 });
  return ApiResponse.ok(res, shelves);
});
