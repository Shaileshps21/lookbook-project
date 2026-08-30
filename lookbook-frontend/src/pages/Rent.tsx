import { useState } from "react";
import { Search, Clock, Truck, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import BookCard from "../components/common/BookCard";
import SectionHeading from "../components/common/SectionHeading";
import Loader from "../components/common/Loader";
import { useBooks } from "../hooks/useBooks";
import { useCategories } from "../hooks/useCategories";

const perks = [
  { icon: Clock, title: "Flexible Duration", description: "Rent for 7, 15, or 30 days — extend anytime." },
  { icon: Truck, title: "Doorstep Delivery", description: "Fast delivery straight to your address." },
  { icon: RotateCcw, title: "Easy Returns", description: "Free pickup when your rental period ends." },
];

const Rent = () => {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [page, setPage] = useState(1);
  const { categoryNames } = useCategories();
  const { books, loading, meta } = useBooks({ search: query, category, page, limit: 12 });

  return (
    <>
      <section className="bg-[#F5F2EA] pt-20 pb-14">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-amber-700 font-semibold uppercase tracking-wider text-sm">Rent A Book</p>
          <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mt-3">
            Read More, Spend Less
          </h1>
          <p className="text-slate-600 mt-4 leading-8">
            Rent thousands of titles at a fraction of the purchase price. Return, swap, or extend anytime.
          </p>

          <div className="mt-8 flex items-center bg-white border border-orange-100 rounded-full px-5 py-4 shadow-sm max-w-xl mx-auto">
            <Search size={18} className="text-slate-400 shrink-0" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search titles to rent..."
              className="outline-none px-3 bg-transparent w-full"
            />
          </div>
        </div>
      </section>

      <section className="bg-[#F5F2EA] pb-16">
        <div className="max-w-6xl mx-auto px-6 grid sm:grid-cols-3 gap-6">
          {perks.map(({ icon: Icon, title, description }) => (
            <div key={title} className="bg-white rounded-3xl p-6 border border-amber-100 shadow-sm text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto">
                <Icon size={20} className="text-amber-600" />
              </div>
              <h3 className="font-bold text-slate-900 mt-4">{title}</h3>
              <p className="text-slate-500 text-sm mt-1">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#F5F2EA] pb-24">
        <div className="max-w-7xl mx-auto px-6">
          <SectionHeading eyebrow="Available Now" title="Books You Can Rent Today" />

          <div className="flex flex-wrap gap-3 mb-10">
            {categoryNames.map((name) => (
              <button
                key={name}
                onClick={() => {
                  setCategory(name);
                  setPage(1);
                }}
                className={`px-5 py-2 rounded-full transition-all font-medium ${
                  category === name ? "bg-slate-900 text-white" : "bg-white text-slate-700 border border-orange-100"
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          {loading ? (
            <Loader label="Finding books to rent..." />
          ) : (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {books.map((book) => (
                  <BookCard key={book.id} book={book} />
                ))}
              </div>

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
        </div>
      </section>
    </>
  );
};

export default Rent;
