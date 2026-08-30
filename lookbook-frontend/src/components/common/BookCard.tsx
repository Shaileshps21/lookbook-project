import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, ShoppingCart, BookOpen } from "lucide-react";
import clsx from "clsx";
import Rating from "./Rating";
import { formatPrice } from "../../utils/format";
import { track } from "../../utils/analytics";
import { useWishlist } from "../../hooks/useWishlist";
import { useCart } from "../../hooks/useCart";
import type { Book } from "../../types";

interface BookCardProps {
  book: Book;
  className?: string;
  /** §13.8/13.3 — recommendation attribution for clicks on the card link. */
  section?: string;
  arm?: string;
  reason?: string;
}

/** Generates a placeholder gradient cover using the book title's first letter */
const BookPlaceholder = ({ title }: { title: string }) => {
  const colors = [
    "from-amber-400 to-orange-500",
    "from-blue-400 to-indigo-600",
    "from-emerald-400 to-teal-600",
    "from-purple-400 to-violet-600",
    "from-rose-400 to-pink-600",
    "from-slate-500 to-slate-700",
  ];
  const colorIndex = title.charCodeAt(0) % colors.length;
  return (
    <div
      className={`w-full h-56 flex flex-col items-center justify-center bg-gradient-to-br ${colors[colorIndex]} rounded-2xl`}
    >
      <BookOpen size={36} className="text-white/80 mb-2" />
      <span className="text-white font-bold text-4xl opacity-70 select-none">
        {title.charAt(0).toUpperCase()}
      </span>
    </div>
  );
};

const BookCard = ({ book, className, section, arm, reason }: BookCardProps) => {
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { addToCart } = useCart();
  const wishlisted = isWishlisted(book.id);
  const [imgFailed, setImgFailed] = useState(false);

  // §13.8 — a click on a recommended book is the engagement signal the A/B
  // report attributes (arm/section/reason arrive from the serving BookRow).
  const handleCardClick = () => {
    if (section) track("recommendation_click", { arm, section, reason, bookId: book.id });
  };

  // Open Library covers sometimes serve 404 small placeholder GIFs — treat
  // those the same as a broken URL by checking image dimensions on load.
  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    // 1x1 pixel placeholder (Open Library's "no cover" response) is < 100px
    if (img.naturalWidth < 50 && img.naturalHeight < 50) {
      setImgFailed(true);
    }
  };

  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ duration: 0.25 }}
      className={clsx(
        "bg-white rounded-3xl p-4 border border-amber-100/70 shadow-sm hover:shadow-xl transition-shadow relative group",
        className
      )}
    >
      <button
        onClick={() => toggleWishlist(book)}
        aria-label="Toggle wishlist"
        className={clsx(
          "absolute top-6 right-6 z-10 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md transition-colors",
          wishlisted ? "bg-amber-500 text-white" : "bg-white/90 text-slate-400 hover:text-amber-500"
        )}
      >
        <Heart size={16} fill={wishlisted ? "currentColor" : "none"} />
      </button>

      <Link to={`/books/${book.id}`} onClick={handleCardClick} className="block">
        <div className="rounded-2xl overflow-hidden bg-[#F5F2EA]">
          {imgFailed || !book.image ? (
            <BookPlaceholder title={book.title} />
          ) : (
            <img
              src={book.image}
              alt={book.title}
              className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-500"
              onError={() => setImgFailed(true)}
              onLoad={handleImgLoad}
              loading="lazy"
            />
          )}
        </div>

        {reason && (
          <span
            title={reason}
            className="inline-block mt-3 max-w-full truncate text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100 px-3 py-1 rounded-full"
          >
            {reason}
          </span>
        )}

        {book.badge && (
          <span className="inline-block mt-3 text-xs font-semibold uppercase tracking-wide bg-amber-100 text-amber-700 px-3 py-1 rounded-full">
            {book.badge}
          </span>
        )}

        <h3 className="mt-3 font-semibold text-slate-900 line-clamp-1">{book.title}</h3>
        <p className="text-sm text-slate-500 line-clamp-1">{book.author}</p>

        <div className="mt-2">
          <Rating value={book.rating} size={13} showValue={false} />
        </div>
      </Link>

      <div className="flex items-center justify-between mt-4">
        <div>
          <p className="text-xs text-slate-400">Rent from</p>
          <p className="font-bold text-slate-900">{formatPrice(book.rentPrice)}</p>
        </div>

        <button
          onClick={() => addToCart(book, "rent")}
          className="w-10 h-10 rounded-full bg-slate-900 hover:bg-amber-500 text-white flex items-center justify-center transition-colors"
          aria-label="Add to cart"
        >
          <ShoppingCart size={16} />
        </button>
      </div>
    </motion.div>
  );
};

export default BookCard;
