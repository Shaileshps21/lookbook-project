import { Award } from "lucide-react";
import type { Badge } from "../../types";

/** A single badge as a real card (icon + title + challenge name + awarded
 * date) instead of the old inert text pill — reused verbatim on both the
 * Challenges page and PublicProfile so a badge looks the same everywhere. */
const BadgeCard = ({ badge }: { badge: Badge }) => (
  <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
    <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
      <Award size={18} />
    </div>
    <div className="min-w-0">
      <p className="text-sm font-bold text-slate-900 truncate">{badge.title}</p>
      <p className="text-[11px] text-slate-500">
        {badge.challenge?.title ? `${badge.challenge.title} · ` : ""}
        {new Date(badge.awardedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      </p>
    </div>
  </div>
);

export default BadgeCard;
