import { useEffect, useState } from "react";
import { Award, Compass, ListChecks, Trophy, Plus, X } from "lucide-react";
import Loader from "../components/common/Loader";
import Button from "../components/common/Button";
import EmptyState from "../components/ui/EmptyState";
import ChallengeCard from "../components/community/ChallengeCard";
import CreateChallengeForm from "../components/community/CreateChallengeForm";
import BadgeCard from "../components/community/BadgeCard";
import { useAuth } from "../hooks/useAuth";
import { fetchChallenges, fetchMyChallenges, fetchMyBadges } from "../services/challengeService";
import type { Challenge, Badge, MyChallenges } from "../types";

type Tab = "discover" | "mine" | "completed";

const TABS: { id: Tab; label: string; icon: typeof Compass }[] = [
  { id: "discover", label: "Discover", icon: Compass },
  { id: "mine", label: "My Challenges", icon: ListChecks },
  { id: "completed", label: "Completed", icon: Trophy },
];

const Challenges = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("discover");
  const [discover, setDiscover] = useState<Challenge[]>([]);
  const [mine, setMine] = useState<MyChallenges>({ active: [], completed: [] });
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [celebration, setCelebration] = useState<Challenge | null>(null);

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      fetchChallenges(),
      user ? fetchMyChallenges() : Promise.resolve({ active: [], completed: [] } as MyChallenges),
      user ? fetchMyBadges() : Promise.resolve([]),
    ])
      .then(([d, m, b]) => {
        setDiscover(d);
        setMine(m);
        setBadges(b);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting state for a new fetch
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleChanged = () => loadAll();

  const handleCompleted = (challenge: Challenge) => {
    setCelebration(challenge);
    loadAll();
    setTimeout(() => setCelebration(null), 4000);
  };

  if (loading) {
    return (
      <section className="bg-[#F5F2EA] min-h-[80vh]">
        <Loader fullScreen label="Loading challenges..." />
      </section>
    );
  }

  return (
    <section className="bg-[#F5F2EA] py-16 min-h-[80vh] relative">
      {celebration && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <Trophy size={20} className="text-amber-400" />
          <div>
            <p className="font-bold text-sm">Challenge completed!</p>
            <p className="text-xs text-slate-300">{celebration.title} — badge earned</p>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-6">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-2">Reading Challenges</h1>
            <p className="text-slate-600">Set goals, join with friends, and actually see who's ahead.</p>
          </div>
          {user && (
            <Button size="sm" icon={creating ? <X size={14} /> : <Plus size={14} />} onClick={() => setCreating((v) => !v)}>
              {creating ? "Cancel" : "Create Challenge"}
            </Button>
          )}
        </div>

        {creating && (
          <div className="mb-8">
            <CreateChallengeForm
              onCreated={() => {
                setCreating(false);
                loadAll();
              }}
              onCancel={() => setCreating(false)}
            />
          </div>
        )}

        {badges.length > 0 && (
          <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6 mb-8">
            <h2 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Award size={18} className="text-amber-500" /> Your Badges
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {badges.map((badge) => (
                <BadgeCard key={badge.id} badge={badge} />
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-6 border-b border-amber-100">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition ${
                tab === id ? "border-amber-500 text-amber-600" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon size={14} /> {label}
              {id === "mine" && mine.active.length > 0 && (
                <span className="text-[10px] bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5">{mine.active.length}</span>
              )}
            </button>
          ))}
        </div>

        {tab === "discover" &&
          (discover.length === 0 ? (
            <p className="text-slate-400">No active challenges right now — be the first to create one.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-6">
              {discover.map((challenge) => (
                <ChallengeCard key={challenge.id} challenge={challenge} onChanged={handleChanged} onCompleted={handleCompleted} />
              ))}
            </div>
          ))}

        {tab === "mine" &&
          (!user ? (
            <EmptyState icon={ListChecks} title="Log in to track challenges" description="Join a challenge to see your progress here." />
          ) : mine.active.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="You haven't joined any challenges yet"
              description="Head to Discover and join one — or create your own."
            />
          ) : (
            <div className="grid sm:grid-cols-2 gap-6">
              {mine.active.map((challenge) => (
                <ChallengeCard key={challenge.id} challenge={challenge} onChanged={handleChanged} onCompleted={handleCompleted} />
              ))}
            </div>
          ))}

        {tab === "completed" &&
          (mine.completed.length === 0 ? (
            <EmptyState icon={Trophy} title="No completed challenges yet" description="Finish a challenge to earn your first badge." />
          ) : (
            <div className="grid sm:grid-cols-2 gap-6">
              {mine.completed.map((challenge) => (
                <ChallengeCard key={challenge.id} challenge={challenge} onChanged={handleChanged} />
              ))}
            </div>
          ))}
      </div>
    </section>
  );
};

export default Challenges;
