import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Globe, Lock, Users, Award } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { updatePublicProfileSetting } from "../../services/userService";
import { fetchFollowCounts, type FollowCounts } from "../../services/followService";

const CommunitySettings = () => {
  const { user, setUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [counts, setCounts] = useState<FollowCounts | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchFollowCounts(user.id)
      .then(setCounts)
      .catch(() => setCounts(null));
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
          <span className="flex items-center gap-1.5">
            <Users size={15} /> {counts?.followers ?? 0} followers · {counts?.following ?? 0} following
          </span>
          {isPublic && (
            <Link to={`/u/${user.id}`} className="text-amber-600 font-semibold hover:underline">
              View public profile
            </Link>
          )}
          <Link to="/challenges" className="flex items-center gap-1 text-amber-600 font-semibold hover:underline">
            <Award size={15} /> Reading Challenges
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
    </div>
  );
};

export default CommunitySettings;
