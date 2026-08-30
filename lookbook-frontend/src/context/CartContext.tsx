import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useAuth } from "./AuthContext";
import { track } from "../utils/analytics";
import {
  fetchServerCart,
  addServerCartItem,
  updateServerCartItem,
  removeServerCartItem,
  clearServerCart,
} from "../services/cartService";
import type { Book, CartItem, CartMode } from "../types";

interface CartContextValue {
  items: CartItem[];
  addToCart: (book: Book, mode: CartMode) => void;
  removeFromCart: (bookId: string, mode: CartMode) => void;
  updateQuantity: (bookId: string, mode: CartMode, quantity: number) => void;
  clearCart: () => void;
  isInCart: (bookId: string, mode: CartMode) => boolean;
  subtotal: number;
  itemCount: number;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [items, setItems] = useLocalStorage<CartItem[]>("lookbook:cart", []);
  const hasSyncedForUser = useRef<string | null>(null);

  // When a user logs in, pull their server-side cart down and use it as the
  // source of truth (replacing whatever was in the guest/local cart).
  useEffect(() => {
    if (!user) {
      hasSyncedForUser.current = null;
      return;
    }
    if (hasSyncedForUser.current === user.id) return;

    hasSyncedForUser.current = user.id;
    fetchServerCart()
      .then((serverItems) => setItems(serverItems))
      .catch(() => {
        // If the fetch fails, keep whatever is already in local storage.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const syncRemote = (action: () => Promise<unknown>) => {
    if (!user) return;
    action().catch(() => {
      // Best-effort sync — the local state already reflects the change,
      // so a transient network error doesn't block the UI.
    });
  };

  const addToCart = (book: Book, mode: CartMode) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.book.id === book.id && i.mode === mode);
      if (existing) {
        return prev.map((i) =>
          i.book.id === book.id && i.mode === mode ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { book, mode, quantity: 1 }];
    });
    // §13.3 — add-to-cart is a conversion signal attributed to the
    // recommendation arm that surfaced this book.
    track("add_to_cart", { bookId: book.id, mode });
    syncRemote(() => addServerCartItem(book.id, mode));
  };

  const removeFromCart = (bookId: string, mode: CartMode) => {
    setItems((prev) => prev.filter((i) => !(i.book.id === bookId && i.mode === mode)));
    syncRemote(() => removeServerCartItem(bookId, mode));
  };

  const updateQuantity = (bookId: string, mode: CartMode, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(bookId, mode);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.book.id === bookId && i.mode === mode ? { ...i, quantity } : i))
    );
    syncRemote(() => updateServerCartItem(bookId, mode, quantity));
  };

  const clearCart = () => {
    setItems([]);
    syncRemote(() => clearServerCart());
  };

  const isInCart = (bookId: string, mode: CartMode) =>
    items.some((i) => i.book.id === bookId && i.mode === mode);

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, i) => sum + (i.mode === "rent" ? i.book.rentPrice : i.book.buyPrice) * i.quantity,
        0
      ),
    [items]
  );

  const itemCount = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        isInCart,
        subtotal,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
};
