import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Users, Award, UserPlus, UserCheck } from "lucide-react";
import Loader from "../components/common/Loader";
import EmptyState from "../components/ui/EmptyState";
import { useAuth } from "../hooks/useAuth";
import { fetchUsersDirectory } from "../services/userService";
import { followUser, unfollowUser } from "../services/followService";
import type { DirectoryUser } from "../types";

const SORTS: { id: "followers" | "badges" | "newest"; label: string }[] = [
  { id: "followers", label: "Most followed" },
  { id: "badges", label: "Most badges" },
  { id: "newest", label: "Newest" },
];

const PersonCard = ({ person, onToggleFollow }: { person: DirectoryUser; onToggleFollow: (id: string) => void }) => {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user || busy) return;
    setBusy(true);
    try {
      if (person.isFollowing) await unfollowUser(person.id);
      else await followUser(person.id);
      onToggleFollow(person.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Link
      to={`/u/${person.id}`}
      className="bg-white rounded-3xl border border-amber-100 shadow-sm p-5 flex items-center gap-4 hover:border-amber-300 transition"
    >
      {person.avatar ? (
        <img src={person.avatar} alt={person.name} className="w-14 h-14 rounded-full object-cover shrink-0" />
      ) : (
        <span className="w-14 h-14 rounded-full bg-amber-500 text-white flex items-center justify-center text-lg font-bold shrink-0">
          {person.name.charAt(0).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-bold text-slate-900 truncate">{person.name}</p>
        <p className="text-xs text-slate-400 flex items-center gap-3 mt-1">
          <span className="flex items-center gap-1">
            <Users size={11} /> {person.followers}
          </span>
          {person.badgesCount > 0 && (
            <span className="flex items-center gap-1">
              <Award size={11} /> {person.badgesCount}
            </span>
          )}
        </p>
        {person.topGenre && (
          <span className="inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
            {person.topGenre}
          </span>
        )}
      </div>
      {user && user.id !== person.id && (
        <button
          onClick={handleClick}
          disabled={busy}
          aria-label={person.isFollowing ? "Unfollow" : "Follow"}
          className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition ${
            person.isFollowing ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600 hover:bg-amber-100"
          }`}
        >
          {person.isFollowing ? <UserCheck size={16} /> : <UserPlus size={16} />}
        </button>
      )}
    </Link>
  );
};

const Community = () => {
  const [people, setPeople] = useState<DirectoryUser[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"followers" | "badges" | "newest">("followers");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const load = (nextPage: number, append: boolean) => {
    setLoading(true);
    fetchUsersDirectory({ q: query || undefined, sort, page: nextPage, limit: 24 })
      .then(({ users, hasMore: more }) => {
        setPeople((prev) => (append ? [...prev, ...users] : users));
        setHasMore(more);
        setPage(nextPage);
      })
      .catch(() => setPeople([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timeout = setTimeout(() => load(1, false), 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, sort]);

  const handleToggleFollow = (id: string) => {
    setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, isFollowing: !p.isFollowing, followers: p.followers + (p.isFollowing ? -1 : 1) } : p)));
  };

  return (
    <section className="bg-[#F5F2EA] py-16 min-h-[80vh]">
      <div className="max-w-6xl mx-auto px-6">
        <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-2">Find Readers</h1>
        <p className="text-slate-600 mb-8">Browse public profiles, see what people are reading, and follow along.</p>

        <div className="flex flex-wrap items-center gap-3 mb-8">
          <div className="flex items-center bg-white rounded-full px-4 py-2.5 border border-orange-100 shadow-sm flex-1 min-w-[220px] max-w-sm">
            <Search size={16} className="text-slate-400 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name..."
              className="outline-none px-3 bg-transparent w-full text-sm"
            />
          </div>
          <div className="flex gap-2">
            {SORTS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSort(s.id)}
                className={`text-xs font-semibold px-3 py-2 rounded-full transition ${
                  sort === s.id ? "bg-amber-500 text-white" : "bg-white text-slate-600 border border-slate-200"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {loading && people.length === 0 ? (
          <Loader label="Loading readers..." />
        ) : people.length === 0 ? (
          <EmptyState icon={Users} title="No public profiles found" description="Try a different search, or check back once more readers opt in." />
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {people.map((person) => (
                <PersonCard key={person.id} person={person} onToggleFollow={handleToggleFollow} />
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={() => load(page + 1, true)}
                  disabled={loading}
                  className="text-sm font-semibold px-6 py-2.5 rounded-full bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 transition"
                >
                  {loading ? "Loading..." : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default Community;
