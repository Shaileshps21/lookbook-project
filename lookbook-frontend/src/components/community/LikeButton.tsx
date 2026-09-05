import { useState } from "react";
import { Heart } from "lucide-react";
import clsx from "clsx";

interface LikeButtonProps {
  liked: boolean;
  count: number;
  onLike: () => Promise<number>;
  onUnlike: () => Promise<number>;
  disabled?: boolean;
  size?: number;
}

/** Optimistic like/unlike toggle shared by post cards and comments — flips
 * immediately, reconciles with the server's returned count, reverts on a
 * failed request. Same optimistic-UI shape `NotificationsSection`'s
 * preference toggles already use elsewhere in this app. */
const LikeButton = ({ liked, count, onLike, onUnlike, disabled, size = 14 }: LikeButtonProps) => {
  const [localLiked, setLocalLiked] = useState(liked);
  const [localCount, setLocalCount] = useState(count);
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy || disabled) return;
    setBusy(true);
    const wasLiked = localLiked;
    setLocalLiked(!wasLiked);
    setLocalCount((c) => (wasLiked ? Math.max(0, c - 1) : c + 1));
    try {
      const newCount = wasLiked ? await onUnlike() : await onLike();
      setLocalCount(newCount);
    } catch {
      setLocalLiked(wasLiked);
      setLocalCount(count);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={clsx(
        "flex items-center gap-1.5 text-xs font-semibold transition-colors",
        localLiked ? "text-rose-500" : "text-slate-400 hover:text-rose-400",
        disabled && "cursor-not-allowed opacity-60"
      )}
      aria-pressed={localLiked}
      aria-label={localLiked ? "Unlike" : "Like"}
    >
      <Heart size={size} fill={localLiked ? "currentColor" : "none"} />
      {localCount > 0 ? localCount : "Like"}
    </button>
  );
};

export default LikeButton;
