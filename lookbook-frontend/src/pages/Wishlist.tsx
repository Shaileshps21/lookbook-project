import { useEffect, useState } from "react";
import { Heart, Plus, Lock, Globe, Trash2 } from "lucide-react";
import { useWishlist } from "../hooks/useWishlist";
import { useAuth } from "../hooks/useAuth";
import { Link } from "react-router-dom";
import BookCard from "../components/common/BookCard";
import EmptyState from "../components/ui/EmptyState";
import Button from "../components/common/Button";
import { fetchMyShelves, createShelf, updateShelf, deleteShelf } from "../services/shelfService";
import type { Shelf } from "../types";

const CustomShelves = () => {
  const { user } = useAuth();
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const load = () => {
    setLoading(true);
    fetchMyShelves()
      .then((all) => setShelves(all.filter((s) => !s.isDefault)))
      .catch(() => setShelves([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // Shelves live server-side — only fetch for logged-in users.
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting state for a new fetch
    load();
  }, [user]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await createShelf(name.trim(), "private");
      setName("");
      load();
    } finally {
      setCreating(false);
    }
  };

  const handleToggleVisibility = async (shelf: Shelf) => {
    await updateShelf(shelf.id, { visibility: shelf.visibility === "public" ? "private" : "public" });
    load();
  };

  const handleDelete = async (shelfId: string) => {
    await deleteShelf(shelfId);
    setShelves((prev) => prev.filter((s) => s.id !== shelfId));
  };

  if (!user) {
    return (
      <div className="mt-16 bg-white rounded-3xl border border-amber-100 shadow-sm p-6">
        <h2 className="font-bold text-slate-900 mb-4">Your Shelves</h2>
        <p className="text-xs text-slate-400 mb-5">
          Organize books into named shelves and optionally share them on your public profile.
        </p>
        <p className="text-sm text-slate-500">
          <Link to="/login" className="text-amber-600 font-semibold hover:underline">
            Log in
          </Link>{" "}
          to create and manage your own shelves.
        </p>
      </div>
    );
  }

  if (loading) return null;

  return (
    <div className="mt-16 bg-white rounded-3xl border border-amber-100 shadow-sm p-6">
      <h2 className="font-bold text-slate-900 mb-4">Your Shelves</h2>
      <p className="text-xs text-slate-400 mb-5">
        Organize books into named shelves and optionally share them on your public profile.
      </p>

      <>
        <div className="flex gap-2 mb-6">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New shelf name (e.g. Sci-Fi Favorites)"
            className="flex-1 px-4 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
          />
          <Button size="sm" icon={<Plus size={14} />} onClick={handleCreate} disabled={creating}>
            Create
          </Button>
        </div>

        {shelves.length === 0 ? (
          <p className="text-slate-400 text-sm">No custom shelves yet.</p>
        ) : (
          <div className="space-y-3">
            {shelves.map((shelf) => (
              <div key={shelf.id} className="flex items-center justify-between border border-slate-100 rounded-2xl p-4">
                <div>
                  <p className="font-medium text-slate-800">{shelf.name}</p>
                  <p className="text-xs text-slate-400">{shelf.books.length} books</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleToggleVisibility(shelf)}
                    className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-50 text-amber-700"
                  >
                    {shelf.visibility === "public" ? <Globe size={12} /> : <Lock size={12} />}
                    {shelf.visibility === "public" ? "Public" : "Private"}
                  </button>
                  <button onClick={() => handleDelete(shelf.id)} className="text-slate-400 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    </div>
  );
};

const Wishlist = () => {
  const { items } = useWishlist();

  return (
    <section className="bg-[#F5F2EA] py-16 min-h-[80vh]">
      <div className="max-w-7xl mx-auto px-6">
        <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-2">Your Wishlist</h1>
        <p className="text-slate-600 mb-10">{items.length} saved books</p>

        {items.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="Your wishlist is empty"
            description="Tap the heart icon on any book to save it here for later."
            actionLabel="Browse Books"
            actionTo="/categories"
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {items.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}

        <CustomShelves />
      </div>
    </section>
  );
};

export default Wishlist;
