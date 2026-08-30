import { BadgeCheck } from "lucide-react";
import Rating from "../common/Rating";
import type { Review } from "../../types";

interface ReviewCardProps {
  review: Review;
}

const ReviewCard = ({ review }: ReviewCardProps) => {
  return (
    <div className="bg-white rounded-3xl p-6 border border-amber-100 shadow-sm h-full flex flex-col">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold shrink-0">
          {review.name.charAt(0)}
        </span>
        <div>
          <p className="font-semibold text-slate-900 flex items-center gap-1">
            {review.name}
            {review.verifiedReader && (
              <span title="Verified Reader — purchased and received this book" className="text-blue-500 flex items-center">
                <BadgeCheck size={15} />
              </span>
            )}
          </p>
          <p className="text-xs text-slate-400">{review.date}</p>
        </div>
      </div>

      <div className="mt-4">
        <Rating value={review.rating} showValue={false} size={14} />
      </div>

      <p className="mt-3 text-slate-600 leading-7 flex-1">{review.comment}</p>
    </div>
  );
};

export default ReviewCard;
