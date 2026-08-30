import { useEffect, useState } from "react";
import { BookOpen, Flame, Wallet, Target } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import Loader from "../common/Loader";
import { formatPrice } from "../../utils/format";
import { fetchReadingStats } from "../../services/readingService";
import type { ReadingStats } from "../../types";

const DAY_MS = 24 * 60 * 60 * 1000;
const dateKey = (d: Date) => d.toISOString().slice(0, 10);

const GENRE_COLORS = ["#f59e0b", "#f43f5e", "#6366f1", "#14b8a6", "#10b981", "#64748b", "#a855f7"];

/** Builds a 90-day GitHub-style contribution grid (7 rows = Sun-Sat, columns
 * = weeks, oldest to newest) from the sparse {date,count} list the API
 * returns — most days have no "finished" entry at all. */
const buildHeatmapWeeks = (calendar: { date: string; count: number }[]): { date: string; count: number }[][] => {
  const counts = new Map(calendar.map((c) => [c.date, c.count]));
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const days: { date: string; count: number }[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY_MS);
    const key = dateKey(d);
    days.push({ date: key, count: counts.get(key) ?? 0 });
  }

  // Pad the front so the first column starts on a Sunday, matching the
  // fixed 7-row (Sun-Sat) layout below.
  const firstDow = new Date(days[0].date).getUTCDay();
  const padded = [...Array(firstDow).fill(null), ...days];

  const weeks: { date: string; count: number }[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }
  return weeks;
};

/** Flat (non-grid) version of the same 90-day series, for the AreaChart. */
const buildDailySeries = (calendar: { date: string; count: number }[]): { date: string; count: number }[] => {
  const counts = new Map(calendar.map((c) => [c.date, c.count]));
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const days: { date: string; count: number }[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY_MS);
    const key = dateKey(d);
    days.push({ date: key.slice(5), count: counts.get(key) ?? 0 });
  }
  return days;
};

const intensityClass = (count: number, max: number): string => {
  if (count === 0) return "bg-amber-50";
  const ratio = count / Math.max(max, 1);
  if (ratio > 0.75) return "bg-amber-600";
  if (ratio > 0.5) return "bg-amber-500";
  if (ratio > 0.25) return "bg-amber-400";
  return "bg-amber-300";
};

const ReadingDashboard = () => {
  const [stats, setStats] = useState<ReadingStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReadingStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader label="Loading reading stats..." />;
  if (!stats) return null;

  const goalProgress = stats.readingGoal ? Math.min(stats.booksFinishedThisMonth / stats.readingGoal, 1) : null;
  const maxCount = Math.max(1, ...stats.calendar.map((c) => c.count));
  const weeks = buildHeatmapWeeks(stats.calendar);
  const dailySeries = buildDailySeries(stats.calendar);
  const topGenre = stats.genreBreakdown[0]?.genre;

  return (
    <div className="bg-white rounded-3xl p-6 border border-amber-100 shadow-sm">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="font-bold text-slate-900">My Reading Journey</h3>
        {stats.streak > 0 && (
          <span className="flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-orange-50 text-orange-600">
            <Flame size={12} /> {stats.streak}-day streak
          </span>
        )}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-amber-50 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-amber-600">
            <BookOpen size={18} />
            <span className="text-xs font-semibold uppercase tracking-wide">Books Read</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.booksRead}</p>
        </div>

        <div className="bg-green-50 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-green-600">
            <Wallet size={18} />
            <span className="text-xs font-semibold uppercase tracking-wide">Money Saved</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{formatPrice(stats.moneySaved)}</p>
        </div>

        <div className="bg-orange-50 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-orange-600">
            <Flame size={18} />
            <span className="text-xs font-semibold uppercase tracking-wide">Reading Streak</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.streak} day{stats.streak === 1 ? "" : "s"}</p>
        </div>

        <div className="bg-blue-50 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-blue-600">
            <Target size={18} />
            <span className="text-xs font-semibold uppercase tracking-wide">
              {stats.readingGoal ? "Monthly Goal" : "Favourite Genre"}
            </span>
          </div>
          {stats.readingGoal ? (
            <>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {stats.booksFinishedThisMonth}/{stats.readingGoal}
              </p>
              <div className="mt-2 h-2 bg-blue-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${(goalProgress ?? 0) * 100}%` }}
                />
              </div>
            </>
          ) : (
            <p className="text-lg font-bold text-slate-900 mt-2">{topGenre ?? "—"}</p>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
            Reading Activity (Last 90 Days)
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={dailySeries} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} interval={14} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#94a3b8" }} width={24} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #fde68a", fontSize: 12 }}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Area type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={2} fill="url(#activityFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
            Books Finished Per Month
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.monthlyBooks} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#94a3b8" }} width={24} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #fde68a", fontSize: 12 }} />
              <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {stats.genreBreakdown.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Favourite Genres</p>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <ResponsiveContainer width="100%" height={200} className="sm:!w-1/2">
              <PieChart>
                <Pie
                  data={stats.genreBreakdown}
                  dataKey="count"
                  nameKey="genre"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={75}
                  paddingAngle={2}
                >
                  {stats.genreBreakdown.map((entry, i) => (
                    <Cell key={entry.genre} fill={GENRE_COLORS[i % GENRE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #fde68a", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 flex flex-wrap gap-2">
              {stats.genreBreakdown.map((g, i) => (
                <span
                  key={g.genre}
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-50 rounded-full px-3 py-1"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: GENRE_COLORS[i % GENRE_COLORS.length] }}
                  />
                  {g.genre} ({g.count})
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 pt-5 border-t border-amber-100">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
          Last 90 days
        </p>
        <div className="flex gap-[3px] overflow-x-auto pb-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day, di) =>
                day ? (
                  <div
                    key={di}
                    title={`${day.date}: ${day.count} book${day.count === 1 ? "" : "s"} finished`}
                    className={`w-3 h-3 rounded-sm ${intensityClass(day.count, maxCount)}`}
                  />
                ) : (
                  <div key={di} className="w-3 h-3" />
                )
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-400">
          <span>Less</span>
          <div className="w-3 h-3 rounded-sm bg-amber-50" />
          <div className="w-3 h-3 rounded-sm bg-amber-300" />
          <div className="w-3 h-3 rounded-sm bg-amber-400" />
          <div className="w-3 h-3 rounded-sm bg-amber-500" />
          <div className="w-3 h-3 rounded-sm bg-amber-600" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
};

export default ReadingDashboard;
