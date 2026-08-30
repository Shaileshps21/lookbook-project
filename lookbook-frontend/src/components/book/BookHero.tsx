import { useState } from "react";
import { ShoppingCart, Heart, Check } from "lucide-react";
import Rating from "../common/Rating";
import Button from "../common/Button";
import { formatPrice } from "../../utils/format";
import { useCart } from "../../hooks/useCart";
import { useWishlist } from "../../hooks/useWishlist";
import type { Book } from "../../types";

interface BookHeroProps {
  book: Book;
}

const BookHero = ({ book }: BookHeroProps) => {
  const { addToCart, isInCart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const [justAdded, setJustAdded] = useState<"rent" | "buy" | null>(null);

  const handleAdd = (mode: "rent" | "buy") => {
    addToCart(book, mode);
    setJustAdded(mode);
    setTimeout(() => setJustAdded(null), 1600);
  };

  return (
    <section className="bg-[#F5F2EA] py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="bg-white rounded-4xl p-8 shadow-sm border border-amber-100 grid lg:grid-cols-2 gap-12">
          {/* Cover */}
          <div className="flex justify-center">
            {book.image ? (
              <img src={book.image} alt={book.title} className="w-72 rounded-2xl shadow-xl" />
            ) : (
              <div className="w-72 h-96 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl shadow-xl flex items-center justify-center">
                <span className="text-white font-bold text-7xl opacity-70 select-none">{book.title.charAt(0).toUpperCase()}</span>
              </div>
            )}
          </div>

          {/* Content */}
          <div>
            {book.badge && (
              <span className="bg-amber-100 text-amber-700 px-4 py-2 rounded-full text-sm font-medium">
                {book.badge}
              </span>
            )}

            <h1 className="mt-5 text-4xl font-bold text-slate-900">{book.title}</h1>
            <p className="mt-3 text-lg text-slate-600">{book.author}</p>

            <div className="mt-5">
              <Rating value={book.rating} count={book.reviewsCount} />
            </div>

            <p className="mt-6 text-slate-600 leading-8">{book.description}</p>

            {/* Prices */}
            <div className="mt-8 flex gap-6">
              <div className="bg-green-50 px-6 py-4 rounded-2xl">
                <p className="text-sm text-slate-500">Rent</p>
                <p className="text-2xl font-bold text-green-600">{formatPrice(book.rentPrice)}</p>
              </div>

              <div className="bg-blue-50 px-6 py-4 rounded-2xl">
                <p className="text-sm text-slate-500">Buy</p>
                <p className="text-2xl font-bold text-blue-600">{formatPrice(book.buyPrice)}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-8 flex flex-wrap gap-4">
              <Button
                variant="primary"
                icon={justAdded === "rent" ? <Check size={18} /> : <ShoppingCart size={18} />}
                onClick={() => handleAdd("rent")}
              >
                {justAdded === "rent" ? "Added to Cart" : isInCart(book.id, "rent") ? "Rent Again" : "Rent Now"}
              </Button>

              <Button
                variant="dark"
                icon={justAdded === "buy" ? <Check size={18} /> : <ShoppingCart size={18} />}
                onClick={() => handleAdd("buy")}
              >
                {justAdded === "buy" ? "Added to Cart" : isInCart(book.id, "buy") ? "Buy Again" : "Buy Now"}
              </Button>
            </div>

            {/* Secondary Actions */}
            <div className="mt-5 flex flex-wrap gap-4">
              <Button variant="outline" icon={<Heart size={18} fill={isWishlisted(book.id) ? "currentColor" : "none"} />} onClick={() => toggleWishlist(book)}>
                {isWishlisted(book.id) ? "Wishlisted" : "Wishlist"}
              </Button>

              <span className="flex items-center text-sm text-slate-500 px-2">
                {book.stock > 0 ? `${book.stock} copies available` : "Currently out of stock"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BookHero;
