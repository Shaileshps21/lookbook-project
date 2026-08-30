import { useEffect, useState } from "react";
import { Eye, Heart, ShoppingBag } from "lucide-react";
import Loader from "../common/Loader";
import { fetchSellerPerformance, type SellerPerformanceRow } from "../../services/sellerService";

const SellerPerformance = () => {
  const [rows, setRows] = useState<SellerPerformanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSellerPerformance()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader label="Loading performance..." />;

  return (
    <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6">
      <h2 className="font-bold text-slate-900 mb-1">Listing Performance</h2>
      <p className="text-xs text-slate-400 mb-5">Views → wishlist adds → purchases, per listing.</p>

      {rows.length === 0 ? (
        <p className="text-slate-500 text-sm">No listings yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.bookId} className="flex items-center justify-between border border-slate-100 rounded-2xl p-4">
              <p className="font-medium text-slate-800">{row.title}</p>
              <div className="flex items-center gap-5 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Eye size={14} /> {row.views}
                </span>
                <span className="flex items-center gap-1">
                  <Heart size={14} /> {row.wishlists}
                </span>
                <span className="flex items-center gap-1">
                  <ShoppingBag size={14} /> {row.purchases}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SellerPerformance;
