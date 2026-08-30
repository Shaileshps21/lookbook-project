import { useState } from "react";
import { Search, Download, CheckCircle2 } from "lucide-react";
import Button from "../common/Button";
import {
  searchBooksApiRequest,
  importBooksApiRequest,
  type ExternalBookResult,
  type ImportBooksResult,
} from "../../services/adminService";
import { useCategories } from "../../hooks/useCategories";

interface BookApiImportProps {
  onImported: () => void;
}

const BookApiImport = ({ onImported }: BookApiImportProps) => {
  const { categoryNames } = useCategories();
  const categories = categoryNames.filter((c) => c !== "All");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "Fiction");
  const [results, setResults] = useState<ExternalBookResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportBooksResult | null>(null);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    setResult(null);
    try {
      const data = await searchBooksApiRequest(query.trim());
      setResults(data);
      setSelected(new Set(data.filter((r) => !r.alreadyImported).map((r) => r.sourceKey)));
    } catch {
      setError("Couldn't search the books API. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const toggleSelected = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleImport = async () => {
    const items = results.filter((r) => selected.has(r.sourceKey));
    if (items.length === 0) return;
    setImporting(true);
    setError("");
    try {
      const res = await importBooksApiRequest(items, category);
      setResult(res);
      setResults((prev) => prev.filter((r) => !selected.has(r.sourceKey)));
      setSelected(new Set());
      onImported();
    } catch {
      setError("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6">
      <h2 className="font-bold text-slate-900 mb-1">Import Books From API</h2>
      <p className="text-xs text-slate-400 mb-4">
        Search real book data from Open Library and add it straight to your catalog — covers, authors, and
        descriptions included.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search by title, author, or subject (e.g. 'stoicism', 'agatha christie')"
          className="flex-1 min-w-[240px] px-4 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400 bg-white"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Button size="sm" icon={<Search size={14} />} onClick={handleSearch} disabled={searching}>
          {searching ? "Searching..." : "Search"}
        </Button>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {result && (
        <div className="mb-4 bg-green-50 border border-green-100 rounded-2xl p-4 text-sm flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-600 shrink-0" />
          <span className="text-green-800">
            Imported {result.imported} book{result.imported === 1 ? "" : "s"}.
            {result.skipped.length > 0 && ` Skipped ${result.skipped.length} (already in catalog or failed).`}
          </span>
        </div>
      )}

      {results.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-400">{selected.size} selected</span>
            <Button size="sm" icon={<Download size={14} />} onClick={handleImport} disabled={importing || selected.size === 0}>
              {importing ? "Importing..." : `Import Selected (${selected.size})`}
            </Button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[480px] overflow-y-auto">
            {results.map((r) => (
              <label
                key={r.sourceKey}
                className={`flex gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                  r.alreadyImported
                    ? "border-slate-100 bg-slate-50 opacity-60"
                    : selected.has(r.sourceKey)
                      ? "border-amber-400 bg-amber-50/50"
                      : "border-slate-100 hover:border-amber-200"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(r.sourceKey)}
                  onChange={() => toggleSelected(r.sourceKey)}
                  disabled={r.alreadyImported}
                  className="mt-1 shrink-0"
                />
                {r.image ? (
                  <img src={r.image} alt="" className="w-12 h-16 object-cover rounded-lg shrink-0 bg-slate-100" />
                ) : (
                  <div className="w-12 h-16 rounded-lg bg-slate-100 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{r.title}</p>
                  <p className="text-xs text-slate-500 truncate">{r.author}</p>
                  {r.alreadyImported && <p className="text-[10px] text-slate-400 mt-1">Already in catalog</p>}
                </div>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default BookApiImport;
