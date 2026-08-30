import SectionHeading from "../common/SectionHeading";
import BookCard from "../common/BookCard";
import type { Book } from "../../types";

interface SimilarBooksProps {
  books: Book[];
}

const SimilarBooks = ({ books }: SimilarBooksProps) => {
  if (books.length === 0) return null;

  return (
    <section className="bg-[#F5F2EA] pb-24">
      <div className="max-w-7xl mx-auto px-6">
        <SectionHeading eyebrow="More To Explore" title="Similar Books" />

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default SimilarBooks;
