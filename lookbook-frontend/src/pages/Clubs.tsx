import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, Plus, X, Share2, Check } from "lucide-react";
import Loader from "../components/common/Loader";
import Button from "../components/common/Button";
import EmptyState from "../components/ui/EmptyState";
import { useAuth } from "../hooks/useAuth";
import { fetchClubs, createClub } from "../services/clubService";
import type { Club } from "../types";

const Clubs = () => {
  const { user } = useAuth();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchClubs()
      .then(setClubs)
      .catch(() => setClubs([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting state for a new fetch
    load();
  }, []);

  const handleShare = async (e: React.MouseEvent, club: Club) => {
    e.preventDefault();
    if (!club.inviteToken) return;
    await navigator.clipboard.writeText(`${window.location.origin}/clubs/join/${club.inviteToken}`);
    setCopiedId(club.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createClub({ name: name.trim(), description: description.trim() });
      setName("");
      setDescription("");
      setFormOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-[#F5F2EA] py-16 min-h-[80vh]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-10">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-slate-900">Book Clubs</h1>
            <p className="text-slate-600 mt-1">Join a club and discuss your favorite books with other readers.</p>
          </div>
          {user && (
            <Button icon={formOpen ? <X size={16} /> : <Plus size={16} />} onClick={() => setFormOpen((v) => !v)}>
              {formOpen ? "Cancel" : "Start a Club"}
            </Button>
          )}
        </div>

        {formOpen && (
          <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6 mb-8 space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Club name"
              className="w-full px-4 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this club about?"
              rows={3}
              className="w-full px-4 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400 resize-none"
            />
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating..." : "Create Club"}
            </Button>
          </div>
        )}

        {loading ? (
          <Loader label="Loading clubs..." />
        ) : clubs.length === 0 ? (
          <EmptyState icon={Users} title="No clubs yet" description="Be the first to start a book club." />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {clubs.map((club) => (
              <Link
                key={club.id}
                to={`/clubs/${club.id}`}
                className="relative bg-white rounded-3xl border border-amber-100 shadow-sm p-6 hover:border-amber-300 transition"
              >
                {user && club.owner.id === user.id && (
                  <button
                    onClick={(e) => handleShare(e, club)}
                    aria-label="Copy invite link"
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-50 hover:bg-amber-50 flex items-center justify-center text-slate-400 hover:text-amber-600 transition"
                  >
                    {copiedId === club.id ? <Check size={14} /> : <Share2 size={14} />}
                  </button>
                )}
                <h3 className="font-bold text-slate-900 pr-8">{club.name}</h3>
                {club.description && <p className="text-sm text-slate-500 mt-2 line-clamp-2">{club.description}</p>}
                <p className="text-xs text-slate-400 mt-4 flex items-center gap-1.5">
                  <Users size={13} /> {club.members.length} members
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default Clubs;
