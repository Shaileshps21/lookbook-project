import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, X } from "lucide-react";
import Button from "../components/common/Button";
import { useCategories } from "../hooks/useCategories";
import { updatePreferences, skipOnboarding } from "../services/userService";
import { useAuth } from "../hooks/useAuth";

const LANGUAGES = ["English", "Hindi", "Spanish", "French", "German", "Japanese"];

const Onboarding = () => {
  const navigate = useNavigate();
  const { setUser, user } = useAuth();
  const { categories } = useCategories();

  const [genres, setGenres] = useState<string[]>([]);
  const [authorInput, setAuthorInput] = useState("");
  const [authors, setAuthors] = useState<string[]>([]);
  const [readingGoal, setReadingGoal] = useState(4);
  const [language, setLanguage] = useState("English");
  const [saving, setSaving] = useState(false);

  const toggleGenre = (name: string) => {
    setGenres((prev) => (prev.includes(name) ? prev.filter((g) => g !== name) : [...prev, name]));
  };

  const addAuthor = () => {
    const trimmed = authorInput.trim();
    if (trimmed && !authors.includes(trimmed)) setAuthors((prev) => [...prev, trimmed]);
    setAuthorInput("");
  };

  const removeAuthor = (name: string) => setAuthors((prev) => prev.filter((a) => a !== name));

  const finish = async (preferences: Awaited<ReturnType<typeof updatePreferences>>) => {
    if (user) setUser({ ...user, preferences });
    navigate("/");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const preferences = await updatePreferences({ genres, authors, readingGoal, language });
      await finish(preferences);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    setSaving(true);
    try {
      const preferences = await skipOnboarding();
      await finish(preferences);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-[#F5F2EA] min-h-[85vh] flex items-center justify-center px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-4xl shadow-sm border border-amber-100 p-10 w-full max-w-2xl"
      >
        <div className="flex items-center gap-2 justify-center mb-4">
          <BookOpen className="text-amber-500" size={26} />
          <span className="text-2xl font-bold text-slate-900">LookBook</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 text-center">Tell us what you love to read</h1>
        <p className="text-slate-500 text-center mt-2 mb-8">
          We'll use this to personalize your homepage. You can change it anytime.
        </p>

        <div className="mb-6">
          <span className="text-sm font-medium text-slate-700">Favourite Genres</span>
          <div className="flex flex-wrap gap-2 mt-3">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleGenre(c.name)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                  genres.includes(c.name) ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-700"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <span className="text-sm font-medium text-slate-700">Favourite Authors</span>
          <div className="flex gap-2 mt-3">
            <input
              value={authorInput}
              onChange={(e) => setAuthorInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAuthor();
                }
              }}
              placeholder="Type a name and press Enter"
              className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition"
            />
            <Button type="button" variant="outline" onClick={addAuthor}>
              Add
            </Button>
          </div>
          {authors.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {authors.map((a) => (
                <span
                  key={a}
                  className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full text-sm"
                >
                  {a}
                  <button type="button" onClick={() => removeAuthor(a)} className="text-slate-400 hover:text-slate-700">
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-6 mb-8">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Reading Goal (books/month)</span>
            <input
              type="number"
              min={1}
              max={30}
              value={readingGoal}
              onChange={(e) => setReadingGoal(Number(e.target.value))}
              className="mt-2 w-full px-4 py-3 rounded-2xl border border-slate-200 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Preferred Language</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="mt-2 w-full px-4 py-3 rounded-2xl border border-slate-200 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition bg-white"
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button fullWidth onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save & Continue"}
          </Button>
          <Button fullWidth variant="ghost" onClick={handleSkip} disabled={saving}>
            Skip for now
          </Button>
        </div>
      </motion.div>
    </section>
  );
};

export default Onboarding;
