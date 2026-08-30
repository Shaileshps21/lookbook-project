import { Star } from "lucide-react";
import clsx from "clsx";

interface RatingProps {
  value: number;
  count?: number;
  size?: number;
  showValue?: boolean;
  className?: string;
}

const Rating = ({ value, count, size = 16, showValue = true, className }: RatingProps) => {
  const stars = [0, 1, 2, 3, 4];

  return (
    <div className={clsx("flex items-center gap-1.5", className)}>
      <div className="flex items-center gap-0.5">
        {stars.map((i) => {
          const filled = value >= i + 1;
          const half = !filled && value > i && value < i + 1;
          return (
            <span key={i} className="relative inline-flex">
              <Star size={size} className="text-slate-200" fill="currentColor" />
              {(filled || half) && (
                <Star
                  size={size}
                  className="text-amber-500 absolute inset-0"
                  fill="currentColor"
                  style={half ? { clipPath: "inset(0 50% 0 0)" } : undefined}
                />
              )}
            </span>
          );
        })}
      </div>

      {showValue && <span className="font-semibold text-slate-800">{value.toFixed(1)}</span>}

      {typeof count === "number" && (
        <span className="text-slate-500 text-sm">({count.toLocaleString("en-IN")})</span>
      )}
    </div>
  );
};

export default Rating;
