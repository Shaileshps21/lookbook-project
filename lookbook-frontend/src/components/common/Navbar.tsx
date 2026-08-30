import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Search, BookOpen, ShoppingCart, Heart, User, Rss } from "lucide-react";
import { useCart } from "../../hooks/useCart";
import { useWishlist } from "../../hooks/useWishlist";
import { useAuth } from "../../hooks/useAuth";
import NotificationBell from "./NotificationBell";

const links = [
  { label: "Browse", to: "/categories" },
  { label: "Categories", to: "/categories" },
  { label: "Rent", to: "/rent" },
  { label: "Sell", to: "/sell" },
  { label: "Plans", to: "/plans" },
  { label: "Clubs", to: "/clubs" },
  { label: "Challenges", to: "/challenges" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { itemCount } = useCart();
  const { items: wishlistItems } = useWishlist();
  const { user } = useAuth();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/categories?search=${encodeURIComponent(query)}`);
    setOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#FFFDF8]/90 border-b border-orange-100">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between gap-6">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <motion.div
            whileHover={{ scale: 1.1 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
            className="flex items-center gap-2"
          >
            <BookOpen className="text-orange-500" size={28} />
            <span className="text-2xl font-bold text-slate-900">LookBook</span>
          </motion.div>
        </Link>

        <nav className="hidden lg:flex items-center gap-8">
          {links.map((link) => (
            <NavLink
              key={link.label}
              to={link.to}
              className={({ isActive }) =>
                `relative font-medium transition-colors ${
                  isActive ? "text-amber-600" : "text-slate-700 hover:text-amber-600"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <form
          onSubmit={handleSearch}
          className="hidden md:flex items-center bg-white rounded-full px-4 py-2 border border-orange-100 shadow-sm flex-1 max-w-xs"
        >
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search books..."
            className="outline-none px-3 bg-transparent w-full"
          />
        </form>

        <div className="hidden lg:flex items-center gap-5">
          <Link to="/wishlist" className="relative text-slate-700 hover:text-amber-600 transition-colors">
            <Heart size={22} />
            {wishlistItems.length > 0 && (
              <span className="absolute -top-2 -right-2 w-4.5 h-4.5 min-w-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
                {wishlistItems.length}
              </span>
            )}
          </Link>

          <Link to="/cart" className="relative text-slate-700 hover:text-amber-600 transition-colors">
            <ShoppingCart size={22} />
            {itemCount > 0 && (
              <span className="absolute -top-2 -right-2 w-4.5 h-4.5 min-w-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
                {itemCount}
              </span>
            )}
          </Link>

          {user && (
            <Link to="/feed" className="text-slate-700 hover:text-amber-600 transition-colors" aria-label="Feed">
              <Rss size={22} />
            </Link>
          )}

          <NotificationBell />

          {user ? (
            <Link
              to="/profile"
              className="flex items-center gap-2 bg-white border border-orange-100 rounded-full pl-2 pr-4 py-1.5 shadow-sm"
            >
              <span className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold">
                {user.name.charAt(0).toUpperCase()}
              </span>
              <span className="text-sm font-medium text-slate-700">{user.name}</span>
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-slate-700 font-medium hover:text-amber-600">
                Login
              </Link>
              <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
                <Link
                  to="/register"
                  className="bg-orange-500 text-white px-5 py-2.5 rounded-full font-medium shadow-md inline-block"
                >
                  Get Started
                </Link>
              </motion.div>
            </>
          )}
        </div>

        <button className="lg:hidden" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          {open ? <X /> : <Menu />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="lg:hidden px-6 pb-6 bg-[#FAF8F4]"
          >
            <form onSubmit={handleSearch} className="flex items-center bg-white rounded-full px-4 py-2 border border-orange-100 mb-4">
              <Search size={18} className="text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search books..."
                className="outline-none px-3 bg-transparent w-full"
              />
            </form>

            <div className="flex flex-col gap-4">
              {links.map((link) => (
                <Link key={link.label} to={link.to} onClick={() => setOpen(false)} className="text-slate-700 font-medium">
                  {link.label}
                </Link>
              ))}

              <div className="flex items-center gap-4 pt-2 border-t border-orange-100">
                <Link to="/wishlist" onClick={() => setOpen(false)} className="flex items-center gap-2 text-slate-700">
                  <Heart size={18} /> Wishlist
                </Link>
                <Link to="/cart" onClick={() => setOpen(false)} className="flex items-center gap-2 text-slate-700">
                  <ShoppingCart size={18} /> Cart
                </Link>
                {user && (
                  <Link to="/feed" onClick={() => setOpen(false)} className="flex items-center gap-2 text-slate-700">
                    <Rss size={18} /> Feed
                  </Link>
                )}
                <Link to={user ? "/profile" : "/login"} onClick={() => setOpen(false)} className="flex items-center gap-2 text-slate-700">
                  <User size={18} /> {user ? "Profile" : "Login"}
                </Link>
              </div>

              {!user && (
                <Link
                  to="/register"
                  onClick={() => setOpen(false)}
                  className="bg-orange-500 text-white py-3 rounded-full text-center font-medium"
                >
                  Get Started
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;
