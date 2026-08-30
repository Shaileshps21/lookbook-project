import { useEffect, useState } from "react";
import { Trophy, Award } from "lucide-react";
import Loader from "../components/common/Loader";
import { useAuth } from "../hooks/useAuth";
import { fetchChallenges, fetchChallengeProgress, fetchLeaderboard, fetchMyBadges } from "../services/challengeService";
import type { Challenge, ChallengeProgress, LeaderboardRow, Badge } from "../types";

const ChallengeCard = ({ challenge }: { challenge: Challenge }) => {
  const { user } = useAuth();
  const [progress, setProgress] = useState<ChallengeProgress | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);

  useEffect(() => {
    if (user) fetchChallengeProgress(challenge.id).then(setProgress).catch(() => setProgress(null));
    fetchLeaderboard(challenge.id).then(setLeaderboard).catch(() => setLeaderboard([]));
  }, [challenge.id, user]);

  return (
    <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6">
      <h3 className="font-bold text-slate-900">{challenge.title}</h3>
      {challenge.description && <p className="text-sm text-slate-500 mt-1">{challenge.description}</p>}

      {progress && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>
              {progress.progress} / {progress.target} books
            </span>
            {progress.completed && <span className="text-green-600 font-semibold">Completed!</span>}
          </div>
          <div className="h-2 bg-amber-50 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500"
              style={{ width: `${Math.min(100, (progress.progress / progress.target) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {leaderboard.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
            <Trophy size={12} /> Leaderboard
          </p>
          <div className="space-y-1.5">
            {leaderboard.slice(0, 5).map((row, i) => (
              <div key={row.userId} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">
                  {i + 1}. {row.name}
                </span>
                <span className="text-slate-400">{row.booksFinished} books</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Challenges = () => {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchChallenges(), user ? fetchMyBadges() : Promise.resolve([])])
      .then(([c, b]) => {
        setChallenges(c);
        setBadges(b);
      })
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <section className="bg-[#F5F2EA] min-h-[80vh]">
        <Loader fullScreen label="Loading challenges..." />
      </section>
    );
  }

  return (
    <section className="bg-[#F5F2EA] py-16 min-h-[80vh]">
      <div className="max-w-5xl mx-auto px-6">
        <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-2">Reading Challenges</h1>
        <p className="text-slate-600 mb-10">Set goals, track progress, and climb the leaderboard.</p>

        {badges.length > 0 && (
          <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6 mb-8">
            <h2 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Award size={18} className="text-amber-500" /> Your Badges
            </h2>
            <div className="flex flex-wrap gap-2">
              {badges.map((badge) => (
                <span key={badge.id} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-50 text-amber-700">
                  {badge.title}
                </span>
              ))}
            </div>
          </div>
        )}

        {challenges.length === 0 ? (
          <p className="text-slate-400">No active challenges right now — check back soon.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-6">
            {challenges.map((challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default Challenges;
