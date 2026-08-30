import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import Loader from "../common/Loader";
import Button from "../common/Button";
import { fetchInventory, updateInventoryItem, delistInventoryItem } from "../../services/sellerService";
import type { Book } from "../../types";

const SellerInventory = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, { rentPrice: string; buyPrice: string; stock: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetchInventory()
      .then((data) => {
        setBooks(data);
        setEdits(
          Object.fromEntries(
            data.map((b) => [b.id, { rentPrice: String(b.rentPrice), buyPrice: String(b.buyPrice), stock: String(b.stock) }])
          )
        );
      })
      .catch(() => setBooks([]))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (bookId: string) => {
    setSavingId(bookId);
    try {
      const edit = edits[bookId];
      const updated = await updateInventoryItem(bookId, {
        rentPrice: Number(edit.rentPrice),
        buyPrice: Number(edit.buyPrice),
        stock: Number(edit.stock),
      });
      setBooks((prev) => prev.map((b) => (b.id === bookId ? updated : b)));
    } finally {
      setSavingId(null);
    }
  };

  const handleDelist = async (bookId: string) => {
    await delistInventoryItem(bookId);
    setBooks((prev) => prev.filter((b) => b.id !== bookId));
  };

  if (loading) return <Loader label="Loading inventory..." />;

  return (
    <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6">
      <h2 className="font-bold text-slate-900 mb-5">Your Inventory</h2>
      {books.length === 0 ? (
        <p className="text-slate-500 text-sm">
          No inventory yet. Once an admin approves a book you've listed for sale, it'll show up here.
        </p>
      ) : (
        <div className="space-y-4">
          {books.map((book) => {
            const edit = edits[book.id] ?? { rentPrice: "", buyPrice: "", stock: "" };
            return (
              <div key={book.id} className="border border-slate-100 rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="font-medium text-slate-800">{book.title}</p>
                    <p className="text-xs text-slate-400">
                      {book.author} {book.condition && `· ${book.condition}`}
                    </p>
                  </div>
                  <button onClick={() => handleDelist(book.id)} className="text-slate-400 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-3 items-end">
                  <label className="text-xs text-slate-500">
                    Rent Price
                    <input
                      type="number"
                      value={edit.rentPrice}
                      onChange={(e) => setEdits({ ...edits, [book.id]: { ...edit, rentPrice: e.target.value } })}
                      className="block mt-1 w-24 px-2 py-1.5 rounded-lg border border-slate-200 text-sm"
                    />
                  </label>
                  <label className="text-xs text-slate-500">
                    Buy Price
                    <input
                      type="number"
                      value={edit.buyPrice}
                      onChange={(e) => setEdits({ ...edits, [book.id]: { ...edit, buyPrice: e.target.value } })}
                      className="block mt-1 w-24 px-2 py-1.5 rounded-lg border border-slate-200 text-sm"
                    />
                  </label>
                  <label className="text-xs text-slate-500">
                    Stock
                    <input
                      type="number"
                      value={edit.stock}
                      onChange={(e) => setEdits({ ...edits, [book.id]: { ...edit, stock: e.target.value } })}
                      className="block mt-1 w-20 px-2 py-1.5 rounded-lg border border-slate-200 text-sm"
                    />
                  </label>
                  <Button size="sm" onClick={() => handleSave(book.id)} disabled={savingId === book.id}>
                    {savingId === book.id ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SellerInventory;
