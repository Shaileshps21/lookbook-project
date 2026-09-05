import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { UserCircle, Users, Lock, Flame, BookOpen, Award, Users2 } from "lucide-react";
import Loader from "../components/common/Loader";
import Button from "../components/common/Button";
import BookCard from "../components/common/BookCard";
import BadgeCard from "../components/community/BadgeCard";
import ProgressRing from "../components/community/ProgressRing";
import { useAuth } from "../hooks/useAuth";
import { fetchPublicProfile } from "../services/userService";
import { followUser, unfollowUser } from "../services/followService";
import { joinChallenge } from "../services/challengeService";
import type { PublicProfile as PublicProfileType } from "../types";

const PublicProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user: viewer } = useAuth();
  const [profile, setProfile] = useState<PublicProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = () => {
      if (!userId) return;
      setLoading(true);
      setNotFound(false);
      fetchPublicProfile(userId)
        .then(setProfile)
        .catch(() => setNotFound(true))
        .finally(() => setLoading(false));
    };
    load();
  }, [userId]);

  const handleFollowToggle = async () => {
    if (!profile || !userId) return;
    setFollowBusy(true);
    try {
      if (profile.isFollowing) {
        await unfollowUser(userId);
        setProfile({ ...profile, isFollowing: false, followers: profile.followers - 1 });
      } else {
        await followUser(userId);
        setProfile({ ...profile, isFollowing: true, followers: profile.followers + 1 });
      }
    } finally {
      setFollowBusy(false);
    }
  };

  const handleJoinChallenge = async (challengeId: string) => {
    await joinChallenge(challengeId);
    setJoinedIds((prev) => new Set(prev).add(challengeId));
  };

  if (loading) {
    return (
      <section className="bg-[#F5F2EA] min-h-[80vh]">
        <Loader fullScreen label="Loading profile..." />
      </section>
    );
  }

  if (notFound || !profile) {
    return (
      <section className="bg-[#F5F2EA] min-h-[80vh] flex items-center justify-center px-6">
        <div className="text-center">
          <Lock size={40} className="text-slate-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900">This profile isn't public</h1>
          <p className="text-slate-500 mt-2">The user hasn't opted in to a public profile, or it doesn't exist.</p>
        </div>
      </section>
    );
  }

  const isSelf = viewer?.id === profile.user.id;
  const stats = [
    { icon: Flame, label: "Day Streak", value: profile.readingStats.streak },
    { icon: BookOpen, label: "Books Read", value: profile.readingStats.booksRead },
    { icon: Users, label: "Followers", value: profile.followers },
    { icon: Award, label: "Badges", value: profile.badges.length },
  ];

  return (
    <section className="bg-[#F5F2EA] py-16 min-h-[80vh]">
      <div className="max-w-5xl mx-auto px-6">
        <div className="bg-white rounded-3xl border border-amber-100 shadow-sm overflow-hidden mb-10">
          <div className="h-24 bg-gradient-to-r from-amber-400 to-rose-400" />
          <div className="px-8 pb-8 -mt-10">
            <div className="flex items-end justify-between flex-wrap gap-6">
              <div className="flex items-end gap-4">
                {profile.user.avatar ? (
                  <img
                    src={profile.user.avatar}
                    alt={profile.user.name}
                    className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md"
                  />
                ) : (
                  <span className="w-20 h-20 rounded-full bg-amber-500 text-white flex items-center justify-center text-2xl font-bold border-4 border-white shadow-md">
                    {profile.user.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="pb-1">
                  <h1 className="text-2xl font-bold text-slate-900">{profile.user.name}</h1>
                  <p className="text-slate-500 flex items-center gap-1.5 mt-1 text-sm">
                    <Users size={14} /> {profile.followers} followers · {profile.following} following
                  </p>
                  {profile.mutualFollowers.length > 0 && (
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      <Users2 size={12} />
                      Followed by {profile.mutualFollowers.map((m) => m.name).join(", ")}
                      {profile.mutualFollowersCount > profile.mutualFollowers.length &&
                        ` +${profile.mutualFollowersCount - profile.mutualFollowers.length} more`}
                    </p>
                  )}
                </div>
              </div>

              {!isSelf && viewer && (
                <Button variant={profile.isFollowing ? "outline" : "primary"} onClick={handleFollowToggle} disabled={followBusy}>
                  {profile.isFollowing ? "Following" : "Follow"}
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              {stats.map(({ icon: Icon, label, value }) => (
                <div key={label} className="bg-slate-50 rounded-2xl p-4 text-center">
                  <Icon size={16} className="mx-auto text-amber-600" />
                  <p className="text-xl font-bold text-slate-900 mt-1">{value}</p>
                  <p className="text-[11px] text-slate-500">{label}</p>
                </div>
              ))}
            </div>

            {profile.readingStats.favouriteGenres.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-5">
                <span className="text-xs text-slate-400 font-medium">Reads mostly:</span>
                {profile.readingStats.favouriteGenres.map((g) => (
                  <span key={g} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
                    {g}
                  </span>
                ))}
              </div>
            )}

            {profile.clubs.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="text-xs text-slate-400 font-medium">Clubs:</span>
                {profile.clubs.map((c) => (
                  <Link
                    key={c.id}
                    to={`/clubs/${c.id}`}
                    className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-10">
          {profile.badges.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Award size={18} className="text-amber-500" /> Badges
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {profile.badges.map((badge) => (
                  <BadgeCard key={badge.id} badge={badge} />
                ))}
              </div>
            </div>
          )}

          {profile.challengesInProgress.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-4">Currently Reading Toward</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {profile.challengesInProgress.map((c) => (
                  <div key={c.id} className="bg-white rounded-2xl border border-amber-100 shadow-sm p-4 flex items-center gap-4">
                    <ProgressRing progress={c.progress} target={c.target} size={48} strokeWidth={5} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{c.title}</p>
                      {/* Every item in this list is something the profile owner has already
                          joined — on your own profile that means you too, so the "join" CTA
                          only makes sense when looking at someone else's profile. */}
                      {viewer && !isSelf && !joinedIds.has(c.id) && (
                        <button
                          onClick={() => handleJoinChallenge(c.id)}
                          className="text-xs text-amber-600 font-semibold hover:underline mt-1"
                        >
                          Join this challenge too
                        </button>
                      )}
                      {!isSelf && joinedIds.has(c.id) && (
                        <span className="text-xs text-green-600 font-semibold mt-1 block">Joined</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {profile.shelves.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-4">Public Shelves</h2>
              <div className="space-y-8">
                {profile.shelves.map((shelf) => (
                  <div key={shelf.id}>
                    <h3 className="font-semibold text-slate-700 mb-3">{shelf.name}</h3>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      {shelf.books.map((book) => (
                        <BookCard key={book.id} book={book} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-4">Recent Reviews</h2>
            {profile.reviews.length === 0 ? (
              <p className="text-slate-400 text-sm flex items-center gap-2">
                <UserCircle size={16} /> No reviews yet.
              </p>
            ) : (
              <div className="space-y-3">
                {profile.reviews.map((review) => (
                  <div key={review.id} className="bg-white rounded-2xl border border-amber-100 shadow-sm p-4">
                    <p className="text-sm text-slate-700">{review.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PublicProfile;
