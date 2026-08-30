import { useParams, Link } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, BookX } from "lucide-react";
import { useBook } from "../hooks/useBook";
import { fetchReviews, submitReview } from "../services/reviewService";
import { track } from "../utils/analytics";
import BookHero from "../components/book/BookHero";
import BookOverview from "../components/book/BookOverview";
import BookReviews from "../components/book/BookReviews";
import SimilarBooks from "../components/book/SimilarBooks";
import EmptyState from "../components/ui/EmptyState";
import Loader from "../components/common/Loader";
import type { Review } from "../types";

const BookDetails = () => {
  const { id } = useParams();
  const { book, similarBooks, loading, notFound } = useBook(id);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    track("product_view", { bookId: id });
  }, [id]);

  const loadReviews = useCallback(() => {
    if (!id) return;
    fetchReviews(id)
      .then(setReviews)
      .catch(() => setReviews([]))
      .finally(() => setReviewsLoading(false));
  }, [id]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const handleSubmitReview = async (rating: number, comment: string) => {
    if (!id) return;
    await submitReview(id, rating, comment);
    loadReviews();
  };

  if (loading) {
    return (
      <div className="bg-[#F5F2EA] min-h-[70vh]">
        <Loader fullScreen label="Loading book details..." />
      </div>
    );
  }

  if (notFound || !book) {
    return (
      <div className="bg-[#F5F2EA] min-h-[70vh]">
        <EmptyState
          icon={BookX}
          title="Book Not Found"
          description="The book you're looking for doesn't exist or may have been removed."
          actionLabel="Browse Books"
          actionTo="/categories"
        />
      </div>
    );
  }

  return (
    <>
      <div className="bg-[#F5F2EA] pt-8 px-6">
        <div className="max-w-7xl mx-auto">
          <Link to="/categories" className="inline-flex items-center gap-1 text-slate-600 hover:text-amber-600 font-medium">
            <ChevronLeft size={18} /> Back to Books
          </Link>
        </div>
      </div>
      <BookHero book={book} />
      <BookOverview book={book} />
      <BookReviews
        reviews={reviews}
        loading={reviewsLoading}
        onSubmit={handleSubmitReview}
        reviewAnalysis={book.reviewAnalysis}
      />
      <SimilarBooks books={similarBooks} />
    </>
  );
};

export default BookDetails;
