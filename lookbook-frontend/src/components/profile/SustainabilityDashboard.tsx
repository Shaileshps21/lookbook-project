import { useEffect, useState } from "react";
import { TreeDeciduous, Leaf, Cloud, Users } from "lucide-react";
import Loader from "../common/Loader";
import { fetchSustainabilityStats } from "../../services/readingService";
import type { SustainabilityStats } from "../../types";

const SustainabilityDashboard = () => {
  const [stats, setStats] = useState<SustainabilityStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSustainabilityStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader label="Loading sustainability impact..." />;
  if (!stats) return null;

  return (
    <div className="bg-white rounded-3xl p-6 border border-amber-100 shadow-sm">
      <h3 className="font-bold text-slate-900 mb-1">Sustainability Impact</h3>
      <p className="text-xs text-slate-400 mb-4">
        Estimated from {stats.assumptions.paperKgPerRental}kg paper and {stats.assumptions.co2KgPerRental}kg CO₂ saved
        per rental vs. buying new, and ~{stats.assumptions.rentalsPerTreeSaved} rentals per tree saved — illustrative
        assumptions, not audited figures.
      </p>

      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-3">Your Impact</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 rounded-2xl p-3 text-center">
              <TreeDeciduous size={18} className="text-green-600 mx-auto" />
              <p className="font-bold text-slate-900 mt-1">{stats.personal.treesSaved}</p>
              <p className="text-[11px] text-slate-500">Trees Saved</p>
            </div>
            <div className="bg-amber-50 rounded-2xl p-3 text-center">
              <Leaf size={18} className="text-amber-600 mx-auto" />
              <p className="font-bold text-slate-900 mt-1">{stats.personal.paperSavedKg}kg</p>
              <p className="text-[11px] text-slate-500">Paper Saved</p>
            </div>
            <div className="bg-blue-50 rounded-2xl p-3 text-center">
              <Cloud size={18} className="text-blue-600 mx-auto" />
              <p className="font-bold text-slate-900 mt-1">{stats.personal.co2ReducedKg}kg</p>
              <p className="text-[11px] text-slate-500">CO₂ Reduced</p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1">
            <Users size={14} /> Community Impact
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-2xl p-3 text-center">
              <p className="font-bold text-slate-900">{stats.community.treesSaved}</p>
              <p className="text-[11px] text-slate-500">Trees Saved</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-3 text-center">
              <p className="font-bold text-slate-900">{stats.community.paperSavedKg}kg</p>
              <p className="text-[11px] text-slate-500">Paper Saved</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-3 text-center">
              <p className="font-bold text-slate-900">{stats.community.co2ReducedKg}kg</p>
              <p className="text-[11px] text-slate-500">CO₂ Reduced</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SustainabilityDashboard;
