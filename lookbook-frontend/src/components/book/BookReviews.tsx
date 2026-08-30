import { useState } from "react";
import { PenSquare, Send, X, Sparkles, ThumbsUp, ThumbsDown } from "lucide-react";
import SectionHeading from "../common/SectionHeading";
import Button from "../common/Button";
import Loader from "../common/Loader";
import ReviewCard from "./ReviewCard";
import { useAuth } from "../../hooks/useAuth";
import { ApiClientError } from "../../services/apiClient";
import type { Review, ReviewAnalysis } from "../../types";

interface BookReviewsProps {
  reviews: Review[];
  loading?: boolean;
  onSubmit: (rating: number, comment: string) => Promise<void>;
  reviewAnalysis?: ReviewAnalysis;
}

const BookReviews = ({ reviews, loading, onSubmit, reviewAnalysis }: BookReviewsProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      setError("Please share a few words about the book.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onSubmit(rating, comment.trim());
      setComment("");
      setRating(5);
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't submit your review.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="bg-[#F5F2EA] pb-16">
      <div className="max-w-7xl mx-auto px-6">
        <SectionHeading
          eyebrow="Reviews"
          title="What Readers Say"
          action={
            user ? (
              <Button variant="outline" icon={open ? <X size={16} /> : <PenSquare size={16} />} onClick={() => setOpen((v) => !v)}>
                {open ? "Cancel" : "Write a Review"}
              </Button>
            ) : (
              <p className="text-sm text-slate-500">
                <a href="/login" className="text-amber-600 font-semibold hover:underline">
                  Log in
                </a>{" "}
                to write a review
              </p>
            )
          }
        />

        {reviewAnalysis?.generatedAt && (
          <div className="bg-white rounded-3xl p-6 border border-amber-100 shadow-sm mb-8">
            <div className="flex items-center gap-2 text-amber-700 font-semibold mb-4">
              <Sparkles size={16} />
              AI Review Summary
              <span className="text-[10px] font-normal text-slate-400 uppercase tracking-wide">AI-generated</span>
            </div>

            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-2 bg-red-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500" style={{ width: `${reviewAnalysis.positivePercent}%` }} />
              </div>
              <span className="text-sm font-semibold text-slate-700">{reviewAnalysis.positivePercent}% positive</span>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              {reviewAnalysis.commonPros.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <ThumbsUp size={12} /> Common Pros
                  </p>
                  <ul className="space-y-1 text-sm text-slate-600">
                    {reviewAnalysis.commonPros.map((pro) => (
                      <li key={pro}>• {pro}</li>
                    ))}
                  </ul>
                </div>
              )}
              {reviewAnalysis.commonCons.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <ThumbsDown size={12} /> Common Cons
                  </p>
                  <ul className="space-y-1 text-sm text-slate-600">
                    {reviewAnalysis.commonCons.map((con) => (
                      <li key={con}>• {con}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-400 mt-4">Overall tone: {reviewAnalysis.emotionalTone}</p>
          </div>
        )}

        {open && user && (
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 border border-amber-100 shadow-sm mb-8">
            <label className="block mb-4">
              <span className="text-sm font-medium text-slate-700">Your Rating</span>
              <div className="flex gap-2 mt-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setRating(value)}
                    className={`w-10 h-10 rounded-xl font-semibold transition-colors ${
                      rating >= value ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-600"
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </label>

            <label className="block mb-4">
              <span className="text-sm font-medium text-slate-700">Your Review</span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                placeholder="What did you think of this book?"
                className="mt-2 w-full px-4 py-3 rounded-2xl border border-slate-200 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition resize-none"
              />
            </label>

            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

            <Button type="submit" icon={<Send size={16} />} disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Review"}
            </Button>
          </form>
        )}

        {loading ? (
          <Loader label="Loading reviews..." />
        ) : reviews.length === 0 ? (
          <p className="text-slate-500">No reviews yet. Be the first to share your thoughts.</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default BookReviews;
