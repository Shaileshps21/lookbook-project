import { Shelf, type IShelf } from "../models/Shelf";
import { User } from "../models/User";

/**
 * The pre-Phase-6 Wishlist was a plain array on User (`user.wishlist`).
 * Shelves generalize that into a proper collection; this lazily creates
 * each user's default "Wishlist" shelf on first access and migrates any
 * legacy array contents into it exactly once.
 */
export const getOrCreateDefaultShelf = async (userId: string): Promise<IShelf> => {
  let shelf = await Shelf.findOne({ user: userId, isDefault: true });
  if (shelf) return shelf;

  const user = await User.findById(userId).select("wishlist");
  shelf = await Shelf.create({
    user: userId,
    name: "Wishlist",
    visibility: "private",
    isDefault: true,
    books: user?.wishlist ?? [],
  });

  return shelf;
};
