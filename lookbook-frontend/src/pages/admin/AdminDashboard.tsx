import { useEffect, useState } from "react";
import { IndianRupee, Users, BookOpen, ShoppingBag, Store, AlertTriangle, Package } from "lucide-react";
import Loader from "../../components/common/Loader";
import { fetchDashboardMetrics, type DashboardMetrics } from "../../services/adminService";
import { formatPrice } from "../../utils/format";
import ProductAnalyticsPanel from "./ProductAnalyticsPanel";

const AdminDashboard = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardMetrics()
      .then(setMetrics)
      .catch(() => setMetrics(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader label="Loading dashboard..." />;
  if (!metrics) return <p className="text-slate-500">Couldn't load dashboard metrics.</p>;

  const cards = [
    { icon: IndianRupee, label: "Revenue (paid orders)", value: formatPrice(metrics.revenue), color: "bg-green-50 text-green-600" },
    { icon: Package, label: "Total Orders", value: metrics.totalOrders, color: "bg-blue-50 text-blue-600" },
    { icon: Users, label: "Total Users", value: metrics.totalUsers, color: "bg-amber-50 text-amber-600" },
    { icon: BookOpen, label: "Total Books", value: metrics.totalBooks, color: "bg-purple-50 text-purple-600" },
    { icon: Store, label: "Pending Seller Applications", value: metrics.pendingSellerApplications, color: "bg-orange-50 text-orange-600" },
    { icon: ShoppingBag, label: "Pending Sell Listings", value: metrics.pendingListings, color: "bg-pink-50 text-pink-600" },
    { icon: AlertTriangle, label: "Pending Damage Reports", value: metrics.pendingDamageReports, color: "bg-red-50 text-red-600" },
  ];

  return (
    <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white rounded-3xl p-6 border border-amber-100 shadow-sm">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${color}`}>
              <Icon size={20} />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-4">{value}</p>
            <p className="text-slate-500 text-sm">{label}</p>
          </div>
        ))}
      </div>
      {/* Self-hosted product analytics (§11.1) */}
      <ProductAnalyticsPanel />
    </>
  );
};

export default AdminDashboard;
