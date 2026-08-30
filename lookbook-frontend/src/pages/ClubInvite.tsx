import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Users, BookOpen } from "lucide-react";
import Loader from "../components/common/Loader";
import Button from "../components/common/Button";
import { useAuth } from "../hooks/useAuth";
import { ApiClientError } from "../services/apiClient";
import { fetchClubByInviteToken, joinByInviteToken } from "../services/clubService";
import type { ClubInvitePreview } from "../types";

const ClubInvite = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, initializing } = useAuth();
  const [preview, setPreview] = useState<ClubInvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [joinedClubId, setJoinedClubId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchClubByInviteToken(token)
      .then(setPreview)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  const handleJoin = async () => {
    if (!token) return;
    setJoining(true);
    setError("");
    try {
      const result = await joinByInviteToken(token);
      setAlreadyMember(result.alreadyMember);
      setJoinedClubId(result.club.id);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't join this club.");
    } finally {
      setJoining(false);
    }
  };

  if (loading || initializing) {
    return (
      <section className="bg-[#F5F2EA] min-h-[80vh]">
        <Loader fullScreen label="Loading invite..." />
      </section>
    );
  }

  if (notFound || !preview) {
    return (
      <section className="bg-[#F5F2EA] min-h-[80vh] flex items-center justify-center px-6">
        <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-10 text-center max-w-md">
          <p className="text-slate-600">This invite link is invalid or has been disabled.</p>
          <Link to="/clubs" className="text-amber-600 font-semibold hover:underline mt-4 inline-block">
            Browse clubs
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[#F5F2EA] min-h-[80vh] flex items-center justify-center px-6 py-16">
      <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-8 max-w-md w-full text-center">
        {preview.book?.image ? (
          <img src={preview.book.image} alt={preview.book.title} className="w-20 h-28 object-cover rounded-xl mx-auto mb-4" />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <BookOpen size={24} className="text-amber-600" />
          </div>
        )}

        <h1 className="text-2xl font-bold text-slate-900">{preview.name}</h1>
        {preview.description && <p className="text-slate-500 mt-2">{preview.description}</p>}
        <p className="text-sm text-slate-400 mt-3">Created by {preview.owner.name}</p>
        <p className="flex items-center justify-center gap-1.5 text-sm text-slate-500 mt-1">
          <Users size={14} /> {preview.memberCount} members
        </p>

        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}

        <div className="mt-6">
          {joinedClubId ? (
            <div className="space-y-3">
              <p className="text-green-700 bg-green-50 rounded-2xl p-3 text-sm">
                {alreadyMember ? "You're already a member!" : `You've joined ${preview.name}!`}
              </p>
              <Button fullWidth onClick={() => navigate(`/clubs/${joinedClubId}`)}>
                Go to Club
              </Button>
            </div>
          ) : !user ? (
            <Button
              fullWidth
              onClick={() => navigate("/login", { state: { from: `/clubs/join/${token}` } })}
            >
              Sign in to join this club
            </Button>
          ) : (
            <Button fullWidth onClick={handleJoin} disabled={joining}>
              {joining ? "Joining..." : `Join ${preview.name}`}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
};

export default ClubInvite;
