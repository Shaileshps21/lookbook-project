import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useAuth } from "./AuthContext";
import { track } from "../utils/analytics";
import {
  fetchServerWishlist,
  toggleServerWishlist,
  removeServerWishlistItem,
} from "../services/wishlistService";
import type { Book } from "../types";

interface WishlistContextValue {
  items: Book[];
  toggleWishlist: (book: Book) => void;
  isWishlisted: (bookId: string) => boolean;
  removeFromWishlist: (bookId: string) => void;
}

const WishlistContext = createContext<WishlistContextValue | undefined>(undefined);

export const WishlistProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [items, setItems] = useLocalStorage<Book[]>("lookbook:wishlist", []);
  const hasSyncedForUser = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      hasSyncedForUser.current = null;
      return;
    }
    if (hasSyncedForUser.current === user.id) return;

    hasSyncedForUser.current = user.id;
    fetchServerWishlist()
      .then((serverItems) => setItems(serverItems))
      .catch(() => {
        // Keep local wishlist if the server fetch fails.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const syncRemote = (action: () => Promise<unknown>) => {
    if (!user) return;
    action().catch(() => {
      // Best-effort sync only.
    });
  };

  const toggleWishlist = (book: Book) => {
    const adding = !items.some((b) => b.id === book.id);
    setItems((prev) =>
      prev.some((b) => b.id === book.id)
        ? prev.filter((b) => b.id !== book.id)
        : [...prev, book]
    );
    // §13.3 — wishlist-add is a conversion signal attributed to the
    // recommendation arm that surfaced this book.
    if (adding) track("wishlist_add", { bookId: book.id });
    syncRemote(() => toggleServerWishlist(book.id));
  };

  const removeFromWishlist = (bookId: string) => {
    setItems((prev) => prev.filter((b) => b.id !== bookId));
    syncRemote(() => removeServerWishlistItem(bookId));
  };

  const isWishlisted = (bookId: string) => items.some((b) => b.id === bookId);

  return (
    <WishlistContext.Provider value={{ items, toggleWishlist, isWishlisted, removeFromWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useWishlist = () => {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within a WishlistProvider");
  return ctx;
};
