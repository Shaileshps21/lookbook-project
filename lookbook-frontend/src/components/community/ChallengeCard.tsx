import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, Users, Sparkles, ShieldCheck, ChevronDown, ChevronUp, Medal } from "lucide-react";
import Button from "../common/Button";
import ProgressRing from "./ProgressRing";
import { useAuth } from "../../hooks/useAuth";
import {
  fetchChallengeProgress,
  fetchLeaderboard,
  joinChallenge,
  leaveChallenge,
} from "../../services/challengeService";
import type { Challenge, ChallengeProgress, LeaderboardData } from "../../types";

const PODIUM_STYLES = ["bg-amber-400 text-white", "bg-slate-300 text-slate-800", "bg-orange-300 text-white"];

interface ChallengeCardProps {
  challenge: Challenge;
  onChanged?: () => void;
  onCompleted?: (challenge: Challenge) => void;
}

const ChallengeCard = ({ challenge, onChanged, onCompleted }: ChallengeCardProps) => {
  const { user } = useAuth();
  // Seeded once from the prop, then owned locally — join/leave already
  // updates this directly, and a parent refetch remounts a differently-keyed
  // card for a different challenge, so there's no case where the prop
  // changes under an already-mounted card for the same challenge.
  const [joined, setJoined] = useState(challenge.joined);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ChallengeProgress | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  useEffect(() => {
    if (!user || !joined) return;
    let cancelled = false;
    fetchChallengeProgress(challenge.id)
      .then((p) => {
        if (cancelled) return;
        setProgress(p);
        if (p.justCompleted) onCompleted?.(challenge);
      })
      .catch(() => {
        if (!cancelled) setProgress(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge.id, joined, user]);

  // Progress is only meaningful while joined — derived at render time
  // instead of resetting the `progress` state synchronously in an effect
  // when `joined` flips false.
  const displayProgress = joined ? progress : null;

  const handleJoinToggle = async () => {
    if (!user) return;
    setBusy(true);
    try {
      if (joined) {
        await leaveChallenge(challenge.id);
        setJoined(false);
      } else {
        await joinChallenge(challenge.id);
        setJoined(true);
      }
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  const toggleLeaderboard = async () => {
    if (showLeaderboard) {
      setShowLeaderboard(false);
      return;
    }
    setShowLeaderboard(true);
    if (!leaderboard) {
      setLeaderboardLoading(true);
      try {
        setLeaderboard(await fetchLeaderboard(challenge.id));
      } finally {
        setLeaderboardLoading(false);
      }
    }
  };

  const daysLeft = Math.max(0, Math.ceil((new Date(challenge.periodEnd).getTime() - new Date().getTime()) / 86_400_000));

  return (
    <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="font-bold text-slate-900">{challenge.title}</h3>
            {challenge.official && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                <ShieldCheck size={10} /> LookBook Official
              </span>
            )}
            {challenge.type === "genre" && challenge.genre && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-fuchsia-50 text-fuchsia-700">
                {challenge.genre}
              </span>
            )}
            {challenge.club && (
              <Link
                to={`/clubs/${challenge.club.id}`}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100"
              >
                {challenge.club.name}
              </Link>
            )}
          </div>
          {challenge.description && <p className="text-sm text-slate-500">{challenge.description}</p>}
          <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Users size={11} /> {challenge.participantsCount} joined
            </span>
            <span>{daysLeft > 0 ? `${daysLeft} days left` : "Ended"}</span>
          </p>
        </div>

        {displayProgress ? (
          <ProgressRing progress={displayProgress.progress} target={displayProgress.target} />
        ) : (
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
            <Sparkles size={20} className="text-amber-400" />
          </div>
        )}
      </div>

      {displayProgress?.completed && (
        <div className="mt-4 text-xs font-semibold text-green-700 bg-green-50 rounded-xl px-3 py-2 flex items-center gap-1.5">
          <Trophy size={13} /> Completed — badge earned!
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        {user ? (
          <Button
            size="sm"
            variant={joined ? "outline" : "primary"}
            onClick={handleJoinToggle}
            disabled={busy || Boolean(displayProgress?.completed)}
          >
            {displayProgress?.completed ? "Joined" : joined ? "Leave" : "Join Challenge"}
          </Button>
        ) : (
          <span className="text-xs text-slate-400">Log in to join</span>
        )}

        <button
          onClick={toggleLeaderboard}
          className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-amber-600 transition"
        >
          <Trophy size={13} /> Leaderboard {showLeaderboard ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {showLeaderboard && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          {leaderboardLoading ? (
            <p className="text-xs text-slate-400">Loading leaderboard...</p>
          ) : !leaderboard || leaderboard.rows.length === 0 ? (
            <p className="text-xs text-slate-400">No one has finished a qualifying book yet — be the first.</p>
          ) : (
            <>
              {leaderboard.rows.length >= 2 && (
                <div className="flex items-end justify-center gap-3 mb-4">
                  {[1, 0, 2].map((idx) => {
                    const row = leaderboard.rows[idx];
                    if (!row) return <div key={idx} className="w-16" />;
                    const podiumHeight = idx === 0 ? "h-16" : idx === 1 ? "h-12" : "h-9";
                    return (
                      <div key={row.userId} className="flex flex-col items-center gap-1 w-16">
                        <span className="w-9 h-9 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold">
                          {row.name.charAt(0).toUpperCase()}
                        </span>
                        <p className="text-[10px] font-semibold text-slate-700 truncate w-full text-center">{row.name}</p>
                        <div
                          className={`w-full rounded-t-lg flex items-start justify-center pt-1 ${podiumHeight} ${PODIUM_STYLES[idx]}`}
                        >
                          <Medal size={12} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-1.5">
                {leaderboard.rows.slice(3, 10).map((row) => (
                  <div key={row.userId} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">
                      {row.rank}. {row.name}
                    </span>
                    <span className="text-slate-400">{row.booksFinished} books</span>
                  </div>
                ))}
              </div>

              {leaderboard.viewerRank && leaderboard.viewerRank.rank > 10 && (
                <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-dashed border-slate-200 font-semibold text-amber-700">
                  <span>You — #{leaderboard.viewerRank.rank || "unranked"}</span>
                  <span>{leaderboard.viewerRank.booksFinished} books</span>
                </div>
              )}

              <p className="text-[10px] text-slate-400 mt-2">{leaderboard.totalParticipants} total participants</p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ChallengeCard;
