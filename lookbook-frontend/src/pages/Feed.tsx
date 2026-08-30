import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Star, CheckCircle2, Users, UserPlus } from "lucide-react";
import Loader from "../components/common/Loader";
import Button from "../components/common/Button";
import EmptyState from "../components/ui/EmptyState";
import { useAuth } from "../hooks/useAuth";
import { fetchFollowingFeed, fetchSuggestedUsers, followUser } from "../services/followService";
import type { FeedItem, SuggestedUser } from "../services/followService";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" });

const Feed = () => {
  const { user, initializing } = useAuth();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    fetchFollowingFeed(1)
      .then((res) => {
        setItems(res.items);
        setHasMore(res.hasMore);
      })
      .finally(() => setLoading(false));
    fetchSuggestedUsers()
      .then(setSuggestions)
      .catch(() => setSuggestions([]));
  }, [user]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await fetchFollowingFeed(next);
      setItems((prev) => [...prev, ...res.items]);
      setHasMore(res.hasMore);
      setPage(next);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleFollow = async (userId: string) => {
    await followUser(userId);
    setFollowedIds((prev) => new Set(prev).add(userId));
  };

  if (initializing) {
    return (
      <section className="bg-[#F5F2EA] min-h-[80vh]">
        <Loader fullScreen label="Loading your feed..." />
      </section>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <section className="bg-[#F5F2EA] py-16 min-h-[80vh]">
      <div className="max-w-5xl mx-auto px-6">
        <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-8">Your Reading Feed</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {loading ? (
              <Loader label="Loading feed..." />
            ) : items.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Nothing here yet"
                description="Follow readers to see their activity — reviews and finished books will show up here."
              />
            ) : (
              <div className="space-y-4">
                {items.map((item, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5 flex gap-4">
                    {item.user.avatar ? (
                      <img src={item.user.avatar} alt={item.user.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center shrink-0">
                        {item.user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {item.type === "review" ? (
                        <>
                          <p className="text-sm text-slate-700">
                            <span className="font-semibold">{item.user.name}</span> reviewed{" "}
                            {item.book ? (
                              <Link to={`/books/${item.book.id}`} className="font-semibold text-amber-600 hover:underline">
                                {item.book.title}
                              </Link>
                            ) : (
                              <span className="font-semibold text-slate-400">a book no longer available</span>
                            )}
                          </p>
                          {item.rating !== undefined && (
                            <div className="flex items-center gap-0.5 mt-1">
                              {Array.from({ length: 5 }).map((_, si) => (
                                <Star
                                  key={si}
                                  size={13}
                                  className={si < item.rating! ? "fill-amber-400 text-amber-400" : "text-slate-200"}
                                />
                              ))}
                            </div>
                          )}
                          {item.content && <p className="text-sm text-slate-500 mt-2 line-clamp-2">{item.content}</p>}
                          {item.book && (
                            <Link to={`/books/${item.book.id}`} className="text-xs font-semibold text-amber-600 hover:underline mt-2 inline-block">
                              View full review
                            </Link>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-slate-700 flex items-center gap-1.5">
                          <CheckCircle2 size={14} className="text-green-500" />
                          <span className="font-semibold">{item.user.name}</span> finished reading{" "}
                          {item.book ? (
                            <Link to={`/books/${item.book.id}`} className="font-semibold text-amber-600 hover:underline">
                              {item.book.title}
                            </Link>
                          ) : (
                            <span className="font-semibold text-slate-400">a book no longer available</span>
                          )}
                        </p>
                      )}
                      <p className="text-xs text-slate-400 mt-2">{formatDate(item.createdAt)}</p>
                    </div>
                  </div>
                ))}

                {hasMore && (
                  <div className="text-center pt-2">
                    <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                      {loadingMore ? "Loading..." : "Load more"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <aside className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6 h-fit">
            <h2 className="font-bold text-slate-900 mb-4">Who to Follow</h2>
            {suggestions.length === 0 ? (
              <p className="text-sm text-slate-400">No suggestions right now.</p>
            ) : (
              <div className="space-y-4">
                {suggestions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3">
                    <Link to={`/u/${s.id}`} className="flex items-center gap-2 min-w-0">
                      {s.avatar ? (
                        <img src={s.avatar} alt={s.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center shrink-0 text-sm">
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm font-medium text-slate-700 truncate">{s.name}</span>
                    </Link>
                    {followedIds.has(s.id) ? (
                      <span className="text-xs text-green-600 font-semibold shrink-0">Following</span>
                    ) : (
                      <button
                        onClick={() => handleFollow(s.id)}
                        className="text-xs font-semibold text-amber-600 hover:underline flex items-center gap-1 shrink-0"
                      >
                        <UserPlus size={12} /> Follow
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
};

export default Feed;
