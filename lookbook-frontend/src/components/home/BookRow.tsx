import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import BookCard from "../common/BookCard";
import SectionHeading from "../common/SectionHeading";
import { track } from "../../utils/analytics";
import type { Book } from "../../types";

interface BookRowProps {
  eyebrow: string;
  title: string;
  books: Book[];
  viewMoreHref?: string;
  personalized?: boolean;
  /** §13.8 — row identity sent with recommendation_view/click events. */
  section?: string;
  /** §13.3 — which recommendation arm served these books. */
  arm?: string;
  /** §13.8 — bookId → explainability label shown on the card. */
  reasons?: Record<string, string>;
}

const BookRow = ({ eyebrow, title, books, viewMoreHref, personalized, section, arm, reasons }: BookRowProps) => {
  useEffect(() => {
    if (!section || books.length === 0) return;
    // One impression event per row with all exposed book ids, so the §13.3
    // report can attribute clicks/conversions per arm.
    track("recommendation_view", { arm, section, bookIds: books.map((b) => b.id) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  if (books.length === 0) return null;

  return (
    <section className="py-16 bg-[#F5F2EA]">
      <div className="max-w-7xl mx-auto px-6">
        <SectionHeading
          eyebrow={eyebrow}
          title={
            personalized ? (
              <span className="inline-flex items-center gap-2">
                {title}
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 align-middle">
                  <Sparkles size={11} /> For You
                </span>
              </span>
            ) : (
              title
            )
          }
          action={
            viewMoreHref ? (
              <Link to={viewMoreHref} className="hidden md:block text-slate-700 font-medium hover:text-amber-700">
                View More →
              </Link>
            ) : undefined
          }
        />

        <div className="flex gap-6 overflow-x-auto scrollbar-hide pb-4">
          {books.map((book) => (
            <div key={book.id} className="min-w-[240px]">
              <BookCard book={book} section={section} arm={arm} reason={reasons?.[book.id]} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BookRow;