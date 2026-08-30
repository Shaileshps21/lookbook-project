import { Link } from "react-router-dom";
import { Minus, Plus, Trash2 } from "lucide-react";
import { formatPrice } from "../../utils/format";
import { useCart } from "../../hooks/useCart";
import type { CartItem as CartItemType } from "../../types";

interface CartLineItemProps {
  item: CartItemType;
}

const CartLineItem = ({ item }: CartLineItemProps) => {
  const { updateQuantity, removeFromCart } = useCart();
  const price = item.mode === "rent" ? item.book.rentPrice : item.book.buyPrice;

  return (
    <div className="flex flex-col sm:flex-row gap-5 bg-white rounded-3xl p-5 border border-amber-100 shadow-sm">
      <Link to={`/books/${item.book.id}`} className="shrink-0">
        {item.book.image ? (
          <img src={item.book.image} alt={item.book.title} className="w-24 h-32 object-cover rounded-2xl" />
        ) : (
          <div className="w-24 h-32 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <span className="text-white font-bold text-3xl opacity-70 select-none">{item.book.title.charAt(0).toUpperCase()}</span>
          </div>
        )}
      </Link>

      <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link to={`/books/${item.book.id}`} className="font-semibold text-slate-900 hover:text-amber-600">
            {item.book.title}
          </Link>
          <p className="text-sm text-slate-500">{item.book.author}</p>
          <span className="inline-block mt-2 text-xs font-semibold uppercase tracking-wide bg-amber-50 text-amber-700 px-3 py-1 rounded-full capitalize">
            {item.mode}
          </span>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 bg-[#F5F2EA] rounded-full px-3 py-1.5">
            <button
              onClick={() => updateQuantity(item.book.id, item.mode, item.quantity - 1)}
              className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-sm"
              aria-label="Decrease quantity"
            >
              <Minus size={14} />
            </button>
            <span className="font-semibold w-4 text-center">{item.quantity}</span>
            <button
              onClick={() => updateQuantity(item.book.id, item.mode, item.quantity + 1)}
              className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-sm"
              aria-label="Increase quantity"
            >
              <Plus size={14} />
            </button>
          </div>

          <p className="font-bold text-slate-900 w-20 text-right">{formatPrice(price * item.quantity)}</p>

          <button
            onClick={() => removeFromCart(item.book.id, item.mode)}
            className="text-slate-400 hover:text-red-500 transition-colors"
            aria-label="Remove item"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CartLineItem;
