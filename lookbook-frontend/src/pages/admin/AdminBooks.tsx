import { Fragment, useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Upload, X, Sparkles } from "lucide-react";
import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import { fetchBooks } from "../../services/bookService";
import {
  createBookRequest,
  updateBookRequest,
  deleteBookRequest,
  bulkImportBooksRequest,
  configureBookPricingRequest,
  runPricingNowRequest,
  type BulkImportResult,
} from "../../services/adminService";
import { parseCsv } from "../../utils/csv";
import BookApiImport from "../../components/admin/BookApiImport";
import type { Book } from "../../types";

type BookFormState = {
  title: string;
  author: string;
  image: string;
  category: string;
  rentPrice: string;
  buyPrice: string;
  description: string;
  publisher: string;
  published: string;
  pages: string;
  language: string;
  isbn: string;
  stock: string;
  badge: string;
  tags: string;
};

const emptyForm: BookFormState = {
  title: "",
  author: "",
  image: "",
  category: "",
  rentPrice: "",
  buyPrice: "",
  description: "",
  publisher: "",
  published: "",
  pages: "",
  language: "English",
  isbn: "",
  stock: "0",
  badge: "",
  tags: "",
};

const formToPayload = (form: BookFormState): Partial<Book> => ({
  title: form.title,
  author: form.author,
  image: form.image,
  category: form.category,
  rentPrice: Number(form.rentPrice),
  buyPrice: Number(form.buyPrice),
  description: form.description,
  publisher: form.publisher,
  published: form.published,
  pages: Number(form.pages),
  language: form.language,
  isbn: form.isbn,
  stock: Number(form.stock),
  badge: form.badge || undefined,
  tags: form.tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean),
});

const AdminBooks = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BookFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pricingId, setPricingId] = useState<string | null>(null);
  const [pricingDraft, setPricingDraft] = useState({ enabled: false, minRentPrice: "", maxRentPrice: "" });
  const [pricingBusy, setPricingBusy] = useState(false);
  const [runMsg, setRunMsg] = useState("");

  const openPricing = (book: Book) => {
    setPricingId(pricingId === book.id ? null : book.id);
    setPricingDraft({
      enabled: book.pricing?.enabled ?? false,
      minRentPrice: book.pricing ? String(book.pricing.minRentPrice) : "",
      maxRentPrice: book.pricing ? String(book.pricing.maxRentPrice) : "",
    });
    setRunMsg("");
  };

  const handleSavePricing = async (bookId: string) => {
    setPricingBusy(true);
    try {
      const config = await configureBookPricingRequest(bookId, {
        enabled: pricingDraft.enabled,
        minRentPrice: pricingDraft.minRentPrice ? Number(pricingDraft.minRentPrice) : 0,
        maxRentPrice: pricingDraft.maxRentPrice ? Number(pricingDraft.maxRentPrice) : 0,
      });
      setBooks((prev) => prev.map((b) => (b.id === bookId ? { ...b, pricing: config } : b)));
      setPricingId(null);
    } finally {
      setPricingBusy(false);
    }
  };

  const handleRunPricing = async () => {
    setPricingBusy(true);
    try {
      await runPricingNowRequest();
      setRunMsg("Smart-pricing sweep queued — enabled books will be re-priced shortly.");
    } catch {
      setRunMsg("Pricing job couldn't be queued (is Redis configured?).");
    } finally {
      setPricingBusy(false);
    }
  };

  const load = () => {
    setLoading(true);
    fetchBooks({ limit: 100 })
      .then((res) => setBooks(res.books))
      .catch(() => setBooks([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting state for a new fetch
    load();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (book: Book) => {
    setEditingId(book.id);
    setForm({
      title: book.title,
      author: book.author,
      image: book.image,
      category: book.category,
      rentPrice: String(book.rentPrice),
      buyPrice: String(book.buyPrice),
      description: book.description,
      publisher: book.publisher ?? "",
      published: book.published ?? "",
      pages: book.pages ? String(book.pages) : "",
      language: book.language,
      isbn: book.isbn ?? "",
      stock: String(book.stock),
      badge: book.badge ?? "",
      tags: book.tags.join(", "),
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = formToPayload(form);
      if (editingId) {
        await updateBookRequest(editingId, payload);
      } else {
        await createBookRequest(payload);
      }
      setFormOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteBookRequest(id);
    setBooks((prev) => prev.filter((b) => b.id !== id));
  };

  const handleCsvUpload = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const rows = parseCsv(text).map((row) => ({
        ...row,
        rentPrice: Number(row.rentPrice),
        buyPrice: Number(row.buyPrice),
        pages: Number(row.pages),
        stock: row.stock ? Number(row.stock) : 0,
        tags: row.tags ? row.tags.split(/[;|]/).map((t) => t.trim()).filter(Boolean) : [],
      }));
      const result = await bulkImportBooksRequest(rows);
      setImportResult(result);
      load();
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <BookApiImport onImported={load} />

      {runMsg && (
        <div className="bg-amber-50/60 border border-amber-100 rounded-2xl px-4 py-3 text-sm text-slate-700">{runMsg}</div>
      )}

      <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h2 className="font-bold text-slate-900">Books</h2>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              icon={<Sparkles size={14} />}
              onClick={handleRunPricing}
              disabled={pricingBusy}
              title="Trigger the rule-based rental price job for opted-in books"
            >
              Run smart pricing
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleCsvUpload(e.target.files[0])}
            />
            <Button size="sm" variant="outline" icon={<Upload size={14} />} onClick={() => fileInputRef.current?.click()} disabled={importing}>
              {importing ? "Importing..." : "Import CSV"}
            </Button>
            <Button size="sm" icon={<Plus size={14} />} onClick={openCreate}>
              Add Book
            </Button>
          </div>
        </div>

        <p className="text-xs text-slate-400 mb-4">
          CSV columns: title, author, image, category, rentPrice, buyPrice, description, publisher, published, pages,
          language, isbn, stock, badge, tags (separate multiple tags with ; or |)
        </p>

        {importResult && (
          <div className="mb-5 bg-amber-50/60 border border-amber-100 rounded-2xl p-4 text-sm">
            <p className="font-medium text-slate-800">
              Imported {importResult.importedCount} of {importResult.importedCount + importResult.errorCount} rows.
            </p>
            {importResult.errors.length > 0 && (
              <ul className="mt-2 space-y-1 text-red-500 text-xs">
                {importResult.errors.map((e) => (
                  <li key={e.row}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {loading ? (
          <Loader label="Loading books..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="pb-2 pr-4">Title</th>
                  <th className="pb-2 pr-4">Category</th>
                  <th className="pb-2 pr-4">Rent</th>
                  <th className="pb-2 pr-4">Buy</th>
                  <th className="pb-2 pr-4">Stock</th>
                  <th className="pb-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {books.map((book) => (
                  <Fragment key={book.id}>
                  <tr className="border-b border-slate-50 last:border-0">
                    <td className="py-3 pr-4 font-medium text-slate-800">{book.title}</td>
                    <td className="py-3 pr-4 text-slate-500">{book.category}</td>
                    <td className="py-3 pr-4 text-slate-500">₹{book.rentPrice}</td>
                    <td className="py-3 pr-4 text-slate-500">₹{book.buyPrice}</td>
                    <td className="py-3 pr-4 text-slate-500">{book.stock}</td>
                    <td className="py-3 pr-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openPricing(book)}
                          className={`text-xs px-2 py-1 rounded-lg border ${
                            book.pricing?.enabled ? "text-amber-700 bg-amber-50 border-amber-200" : "text-slate-400 border-slate-200 hover:text-amber-600"
                          }`}
                          title="Smart rental pricing"
                        >
                          {book.pricing?.enabled ? "Pricing on" : "Pricing"}
                        </button>
                        <button onClick={() => openEdit(book)} className="text-slate-400 hover:text-amber-600">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => handleDelete(book.id)} className="text-slate-400 hover:text-red-500">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {pricingId === book.id && (
                    <tr>
                      <td colSpan={6} className="py-3 bg-amber-50/40">
                        <div className="flex flex-wrap items-end gap-3">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={pricingDraft.enabled}
                              onChange={(e) => setPricingDraft((d) => ({ ...d, enabled: e.target.checked }))}
                              className="accent-amber-500"
                            />
                            <span className="text-slate-600">Enable daily price adjustment</span>
                          </label>
                          <label className="block text-xs">
                            <span className="text-slate-500">Min rent ₹</span>
                            <input
                              type="number"
                              min={0}
                              value={pricingDraft.minRentPrice}
                              onChange={(e) => setPricingDraft((d) => ({ ...d, minRentPrice: e.target.value }))}
                              className="mt-1 w-28 px-3 py-1.5 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
                            />
                          </label>
                          <label className="block text-xs">
                            <span className="text-slate-500">Max rent ₹</span>
                            <input
                              type="number"
                              min={0}
                              value={pricingDraft.maxRentPrice}
                              onChange={(e) => setPricingDraft((d) => ({ ...d, maxRentPrice: e.target.value }))}
                              className="mt-1 w-28 px-3 py-1.5 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
                            />
                          </label>
                          <Button size="sm" onClick={() => handleSavePricing(book.id)} disabled={pricingBusy}>
                            {pricingBusy ? "Saving…" : "Save"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {formOpen && (
        <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-slate-900">{editingId ? "Edit Book" : "Add Book"}</h3>
            <button onClick={() => setFormOpen(false)} className="text-slate-400 hover:text-slate-700">
              <X size={18} />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {(
              [
                ["title", "Title"],
                ["author", "Author"],
                ["image", "Image URL"],
                ["category", "Category"],
                ["rentPrice", "Rent Price"],
                ["buyPrice", "Buy Price"],
                ["publisher", "Publisher"],
                ["published", "Published Date"],
                ["pages", "Pages"],
                ["language", "Language"],
                ["isbn", "ISBN"],
                ["stock", "Stock"],
                ["badge", "Badge (optional)"],
                ["tags", "Tags (comma-separated)"],
              ] as [keyof BookFormState, string][]
            ).map(([key, label]) => (
              <label key={key} className="block">
                <span className="text-xs font-medium text-slate-500">{label}</span>
                <input
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
                />
              </label>
            ))}
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-500">Description</span>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400 resize-none"
              />
            </label>
          </div>
          <Button className="mt-5" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : editingId ? "Save Changes" : "Create Book"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default AdminBooks;
