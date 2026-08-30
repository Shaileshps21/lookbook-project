import { useSearchParams } from "react-router-dom";
import { useState } from "react";
import { motion } from "framer-motion";
import { SlidersHorizontal, SearchX, ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import BookCard from "../components/common/BookCard";
import SearchBar from "../components/common/SearchBar";
import EmptyState from "../components/ui/EmptyState";
import Loader from "../components/common/Loader";
import { useBooks } from "../hooks/useBooks";
import { useCategories } from "../hooks/useCategories";
import { aiSearchBooks, type AiSearchResult } from "../services/bookService";
import type { BookListParams } from "../services/bookService";

const sortOptions = [
  { label: "Most Popular", value: "popular" },
  { label: "Price: Low to High", value: "price-asc" },
  { label: "Price: High to Low", value: "price-desc" },
  { label: "Top Rated", value: "rating" },
];

const Categories = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("search") ?? "";
  const category = searchParams.get("category") ?? "All";
  const [sort, setSort] = useState<BookListParams["sort"]>("popular");
  const [page, setPage] = useState(1);

  const [aiMode, setAiMode] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AiSearchResult | null>(null);

  const { categoryNames } = useCategories();
  const { books, loading, meta } = useBooks({ search: query, category, sort, page, limit: 12 });

  const handleCategoryClick = (name: string) => {
    setPage(1);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (name === "All") next.delete("category");
      else next.set("category", name);
      return next;
    });
  };

  const handleSearch = (q: string) => {
    setPage(1);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (q) next.set("search", q);
      else next.delete("search");
      return next;
    });
  };

  const handleAiSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    try {
      setAiResult(await aiSearchBooks(aiQuery.trim()));
    } catch {
      setAiResult({ results: [], interpretedAs: null });
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <section className="bg-[#F5F2EA] py-16 min-h-[80vh]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-10">
          <p className="text-amber-700 font-semibold uppercase tracking-wider text-sm">Browse</p>
          <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mt-2">All Categories</h1>
          <p className="text-slate-600 mt-3">Explore our full catalog across every genre.</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 mb-4">
          <SearchBar
            variant="page"
            className="flex-1"
            placeholder="Search by title, author, or tag..."
            defaultValue={query}
            onSearch={handleSearch}
          />

          <div className="flex items-center gap-2 bg-white border border-orange-100 rounded-2xl px-4">
            <SlidersHorizontal size={18} className="text-slate-400" />
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as BookListParams["sort"]);
                setPage(1);
              }}
              className="outline-none bg-transparent py-4 text-slate-700"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setAiMode((v) => !v)}
            className={`flex items-center gap-2 px-5 rounded-2xl font-medium transition ${
              aiMode ? "bg-amber-500 text-white" : "bg-white border border-orange-100 text-slate-700"
            }`}
          >
            <Sparkles size={16} /> Ask AI
          </button>
        </div>

        {aiMode && (
          <form onSubmit={handleAiSearch} className="mb-8 bg-white rounded-3xl p-5 border border-amber-200 shadow-sm">
            <div className="flex items-center gap-2 text-amber-700 font-semibold mb-3 text-sm">
              <Sparkles size={16} /> Ask in plain English — e.g. "business books under ₹50"
            </div>
            <div className="flex gap-2">
              <input
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                placeholder="What are you in the mood to read?"
                className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                disabled={aiLoading || !aiQuery.trim()}
                className="px-6 rounded-2xl bg-amber-500 text-white font-semibold disabled:opacity-50"
              >
                {aiLoading ? "Thinking..." : "Search"}
              </button>
              {aiResult && (
                <button
                  type="button"
                  onClick={() => setAiResult(null)}
                  className="px-4 rounded-2xl bg-slate-100 text-slate-500"
                  aria-label="Clear AI results"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </form>
        )}

        {aiMode && aiResult ? (
          <>
            {aiResult.interpretedAs && (
              <p className="text-xs text-slate-400 mb-6">
                Interpreted as: {JSON.stringify(aiResult.interpretedAs)}
              </p>
            )}
            {aiResult.results.length === 0 ? (
              <EmptyState icon={SearchX} title="No matches" description="Try rephrasing your request." />
            ) : (
              <motion.div layout className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {aiResult.results.map((book) => (
                  <BookCard key={book.id} book={book} />
                ))}
              </motion.div>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-3 mb-10">
              {categoryNames.map((name) => (
                <button
                  key={name}
                  onClick={() => handleCategoryClick(name)}
                  className={`px-5 py-2 rounded-full transition-all font-medium ${
                    category === name ? "bg-slate-900 text-white" : "bg-white text-slate-700 border border-orange-100"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>

            {loading ? (
              <Loader label="Loading books..." />
            ) : books.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No books found"
                description="Try adjusting your search or filters to find what you're looking for."
              />
            ) : (
              <>
                <p className="text-slate-500 mb-6">{meta.total} books found</p>

                <motion.div layout className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {books.map((book) => (
                    <BookCard key={book.id} book={book} />
                  ))}
                </motion.div>

                {meta.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 mt-12">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="w-10 h-10 rounded-full bg-white border border-orange-100 flex items-center justify-center disabled:opacity-40"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span className="text-slate-600 font-medium">
                      Page {meta.page} of {meta.totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                      disabled={page >= meta.totalPages}
                      className="w-10 h-10 rounded-full bg-white border border-orange-100 flex items-center justify-center disabled:opacity-40"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default Categories;
