import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { UserCircle, Users, Lock } from "lucide-react";
import Loader from "../components/common/Loader";
import Button from "../components/common/Button";
import BookCard from "../components/common/BookCard";
import { useAuth } from "../hooks/useAuth";
import { fetchPublicProfile } from "../services/userService";
import { followUser, unfollowUser } from "../services/followService";
import type { PublicProfile as PublicProfileType } from "../types";

const PublicProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user: viewer } = useAuth();
  const [profile, setProfile] = useState<PublicProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

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

  return (
    <section className="bg-[#F5F2EA] py-16 min-h-[80vh]">
      <div className="max-w-5xl mx-auto px-6">
        <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-8 flex items-center justify-between flex-wrap gap-6 mb-10">
          <div className="flex items-center gap-4">
            <span className="w-16 h-16 rounded-full bg-amber-500 text-white flex items-center justify-center text-2xl font-bold">
              {profile.user.name.charAt(0).toUpperCase()}
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{profile.user.name}</h1>
              <p className="text-slate-500 flex items-center gap-1.5 mt-1">
                <Users size={15} /> {profile.followers} followers · {profile.following} following
              </p>
            </div>
          </div>

          {!isSelf && viewer && (
            <Button variant={profile.isFollowing ? "outline" : "primary"} onClick={handleFollowToggle} disabled={followBusy}>
              {profile.isFollowing ? "Following" : "Follow"}
            </Button>
          )}
        </div>

        <div className="space-y-10">
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
