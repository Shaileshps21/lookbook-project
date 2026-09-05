import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Globe, Lock, Users, Award, Search } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { updatePublicProfileSetting } from "../../services/userService";
import { fetchFollowCounts, type FollowCounts } from "../../services/followService";
import FollowListModal from "./FollowListModal";

const CommunitySettings = () => {
  const { user, setUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [counts, setCounts] = useState<FollowCounts | null>(null);
  const [listTab, setListTab] = useState<"followers" | "following" | null>(null);

  const loadCounts = () => {
    if (!user) return;
    fetchFollowCounts(user.id)
      .then(setCounts)
      .catch(() => setCounts(null));
  };

  useEffect(() => {
    loadCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user) return null;

  const isPublic = Boolean(user.publicProfile);

  const handleToggle = async () => {
    setSaving(true);
    try {
      const publicProfile = await updatePublicProfileSetting(!isPublic);
      setUser({ ...user, publicProfile });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6">
      <h2 className="font-bold text-slate-900 mb-4">Community</h2>

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 text-sm text-slate-600">
          <button
            onClick={() => setListTab("followers")}
            className="flex items-center gap-1.5 hover:text-amber-600 transition"
          >
            <Users size={15} />
            <span className="underline decoration-dotted">{counts?.followers ?? 0} followers</span>
          </button>
          <span>·</span>
          <button onClick={() => setListTab("following")} className="hover:text-amber-600 transition">
            <span className="underline decoration-dotted">{counts?.following ?? 0} following</span>
          </button>
          {isPublic && (
            <Link to={`/u/${user.id}`} className="text-amber-600 font-semibold hover:underline">
              View public profile
            </Link>
          )}
          <Link to="/challenges" className="flex items-center gap-1 text-amber-600 font-semibold hover:underline">
            <Award size={15} /> Reading Challenges
          </Link>
          <Link to="/community" className="flex items-center gap-1 text-amber-600 font-semibold hover:underline">
            <Search size={15} /> Find Readers
          </Link>
        </div>

        <button
          onClick={handleToggle}
          disabled={saving}
          className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full transition ${
            isPublic ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"
          }`}
        >
          {isPublic ? <Globe size={13} /> : <Lock size={13} />}
          {isPublic ? "Profile is Public" : "Profile is Private"}
        </button>
      </div>

      {listTab && (
        <FollowListModal
          userId={user.id}
          initialTab={listTab}
          onClose={() => setListTab(null)}
          onCountsChanged={loadCounts}
        />
      )}
    </div>
  );
};

export default CommunitySettings;
