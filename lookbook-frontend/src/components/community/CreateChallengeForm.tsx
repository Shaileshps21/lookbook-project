import { useEffect, useState } from "react";
import Button from "../common/Button";
import { useAuth } from "../../hooks/useAuth";
import { createChallenge } from "../../services/challengeService";
import { fetchClubs } from "../../services/clubService";
import { ApiClientError } from "../../services/apiClient";
import type { Club, ChallengeType } from "../../types";

const toDateInput = (d: Date) => d.toISOString().slice(0, 10);

interface CreateChallengeFormProps {
  defaultClubId?: string;
  onCreated: () => void;
  onCancel: () => void;
}

/** Any logged-in user can propose a challenge — platform-wide or scoped to a
 * club they belong to. Only an admin sees the "Official" toggle. */
const CreateChallengeForm = ({ defaultClubId, onCreated, onCancel }: CreateChallengeFormProps) => {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ChallengeType>("books");
  const [genre, setGenre] = useState("");
  const [target, setTarget] = useState(5);
  const [periodStart, setPeriodStart] = useState(toDateInput(new Date()));
  const [periodEnd, setPeriodEnd] = useState(toDateInput(new Date(new Date().getTime() + 30 * 86_400_000)));
  const [clubId, setClubId] = useState(defaultClubId ?? "");
  const [official, setOfficial] = useState(false);
  const [myClubs, setMyClubs] = useState<Club[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (defaultClubId || !user) return;
    fetchClubs()
      .then((clubs) => setMyClubs(clubs.filter((c) => c.members.some((m) => m.id === user.id))))
      .catch(() => setMyClubs([]));
  }, [defaultClubId, user]);

  const handleSubmit = async () => {
    setError("");
    if (!title.trim() || !target || target < 1) {
      setError("A title and a target of at least 1 are required.");
      return;
    }
    if (type === "genre" && !genre.trim()) {
      setError("Pick a genre for a genre-specific challenge.");
      return;
    }
    setSaving(true);
    try {
      await createChallenge({
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        genre: type === "genre" ? genre.trim() : undefined,
        target,
        periodStart: new Date(periodStart).toISOString(),
        periodEnd: new Date(periodEnd).toISOString(),
        clubId: clubId || undefined,
        official,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't create the challenge.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6 space-y-4">
      <h3 className="font-bold text-slate-900">Create a Challenge</h3>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Summer Reading Sprint"
        className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
        maxLength={100}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What's this challenge about? (optional)"
        rows={2}
        className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400 resize-none"
        maxLength={500}
      />

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ChallengeType)}
            className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
          >
            <option value="books">Books finished</option>
            <option value="genre">Books in one genre</option>
          </select>
        </label>
        {type === "genre" && (
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">Genre</span>
            <input
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              placeholder="e.g. Fiction"
              className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
            />
          </label>
        )}
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">Target (books)</span>
          <input
            type="number"
            min={1}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
          />
        </label>
        {!defaultClubId && (
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">Scope to a club (optional)</span>
            <select
              value={clubId}
              onChange={(e) => setClubId(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
            >
              <option value="">Public — everyone</option>
              {myClubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">Starts</span>
          <input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">Ends</span>
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
          />
        </label>
      </div>

      {user?.role === "admin" && (
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={official} onChange={(e) => setOfficial(e.target.checked)} />
          Mark as "LookBook Official"
        </label>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? "Creating..." : "Create Challenge"}
        </Button>
      </div>
    </div>
  );
};

export default CreateChallengeForm;
