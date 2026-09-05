import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X, UserMinus } from "lucide-react";
import Loader from "../common/Loader";
import { fetchFollowers, fetchFollowing, unfollowUser, removeFollower } from "../../services/followService";
import type { PublicUser } from "../../types";

type Tab = "followers" | "following";

interface FollowListModalProps {
  userId: string;
  initialTab: Tab;
  onClose: () => void;
  /** Lets the caller (CommunitySettings) refresh its own follower/following
   * counts once the modal has made changes — cheaper than re-deriving counts
   * from the two lists this modal already holds. */
  onCountsChanged?: () => void;
}

/** Own-profile followers/following management — view both lists and remove
 * people from either: unfollow someone you follow, or remove someone who
 * follows you (Follow has no concept of mutual consent, so removing a
 * follower is the only lever you have over who's in that list). */
const FollowListModal = ({ userId, initialTab, onClose, onCountsChanged }: FollowListModalProps) => {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [followers, setFollowers] = useState<PublicUser[] | null>(null);
  const [following, setFollowing] = useState<PublicUser[] | null>(null);
  // Starts true; the modal is mounted fresh each time it opens with a fixed
  // userId, so there's no later prop change that would need to re-trigger
  // a loading state reset.
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchFollowers(userId), fetchFollowing(userId)])
      .then(([f, g]) => {
        setFollowers(f);
        setFollowing(g);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const handleRemoveFollower = async (id: string) => {
    setBusyId(id);
    try {
      await removeFollower(id);
      setFollowers((prev) => (prev ? prev.filter((u) => u.id !== id) : prev));
      onCountsChanged?.();
    } finally {
      setBusyId(null);
    }
  };

  const handleUnfollow = async (id: string) => {
    setBusyId(id);
    try {
      await unfollowUser(id);
      setFollowing((prev) => (prev ? prev.filter((u) => u.id !== id) : prev));
      onCountsChanged?.();
    } finally {
      setBusyId(null);
    }
  };

  const rows = tab === "followers" ? followers : following;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl p-6 max-w-md w-full max-h-[80vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1 bg-slate-100 rounded-full p-1">
            <button
              onClick={() => setTab("followers")}
              className={`px-4 py-1.5 text-sm font-semibold rounded-full transition ${
                tab === "followers" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              Followers{followers ? ` (${followers.length})` : ""}
            </button>
            <button
              onClick={() => setTab("following")}
              className={`px-4 py-1.5 text-sm font-semibold rounded-full transition ${
                tab === "following" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              Following{following ? ` (${following.length})` : ""}
            </button>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto -mx-2 px-2 space-y-1">
          {loading ? (
            <Loader label="Loading..." />
          ) : !rows || rows.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">
              {tab === "followers" ? "No followers yet." : "Not following anyone yet."}
            </p>
          ) : (
            rows.map((person) => (
              <div key={person.id} className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-slate-50">
                <Link to={`/u/${person.id}`} onClick={onClose} className="flex items-center gap-3 flex-1 min-w-0">
                  {person.avatar ? (
                    <img src={person.avatar} alt={person.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <span className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold shrink-0">
                      {person.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="text-sm font-medium text-slate-800 truncate">{person.name}</span>
                </Link>
                <button
                  onClick={() => (tab === "followers" ? handleRemoveFollower(person.id) : handleUnfollow(person.id))}
                  disabled={busyId === person.id}
                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600 transition shrink-0 disabled:opacity-50"
                >
                  <UserMinus size={12} /> {tab === "followers" ? "Remove" : "Unfollow"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default FollowListModal;
